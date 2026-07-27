import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Dynamically gets a Gemini GenerativeModel instance with the latest API Key from env
 */
export function getGeminiModel(modelName = 'gemini-1.5-flash', jsonMode = false) {
  const apiKey = process.env.GEMINI_API_KEY || ''
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: modelName,
    ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  })
}

/**
 * Backward compatibility proxy for geminiModel
 */
export const geminiModel = {
  generateContent: (args: Parameters<ReturnType<typeof getGeminiModel>['generateContent']>[0]) => {
    return getGeminiModel().generateContent(args)
  },
}

const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

/**
 * Converts a File or Blob into the format expected by the Gemini API
 */
export async function fileToGenerativePart(file: File): Promise<{
  inlineData: {
    data: string
    mimeType: string
  }
}> {
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  let mimeType = file.type
  if (!mimeType || !SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    mimeType = 'image/jpeg'
  }

  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  }
}
