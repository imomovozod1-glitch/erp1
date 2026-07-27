import { getGeminiModel, fileToGenerativePart } from '@/lib/gemini'

/**
 * Sends an image to an OpenAI-compatible endpoint for structured text extraction.
 * Falls back to Gemini if OPENAI_API_KEY is not configured in env.
 */
export async function analyzeImageWithOpenAI(
  file: File,
  prompt: string,
  jsonMode: boolean = false
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const apiBase = process.env.OPENAI_API_BASE_URL?.trim() || 'https://api.openai.com/v1'
  const modelName = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  // Fallback to Gemini if no OpenAI API key is present
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set. Falling back to Gemini API...')
    
    // Convert to Gemini format
    const imagePart = await fileToGenerativePart(file)
    const geminiModelName = jsonMode ? 'gemini-1.5-flash' : 'gemini-1.5-flash'
    const model = getGeminiModel(geminiModelName, jsonMode)
    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response
    return response.text().trim()
  }

  // Convert File/Blob to base64
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  console.log(`Sending image to OpenAI compatible API at ${apiBase} (Model: ${modelName})...`)

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API returned error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('No content returned in OpenAI API response.')
  }

  return content.trim()
}
