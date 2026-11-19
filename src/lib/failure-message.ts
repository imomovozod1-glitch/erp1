import { errorMessage } from '@/lib/error-message'
import { BusinessRpcError, businessRpcErrorMessage } from '@/lib/business-rpc'

type RootTranslator = Parameters<typeof errorMessage>[0]

export const failureMessage = (tRoot: RootTranslator, error: unknown, fallback: string) =>
  error instanceof BusinessRpcError ? businessRpcErrorMessage(tRoot, error) : errorMessage(tRoot, error, fallback)
