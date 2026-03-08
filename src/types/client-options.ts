import type { AuthCredentials } from './auth-grants'

export interface ShotGridClientOptions {
	baseUrl: string
	credentials: AuthCredentials
	apiVersion?: 'v1' | 'v1.1'
	timeoutMs?: number
	maxRetries?: number
	retryBaseDelayMs?: number
	leewayMs?: number
}
