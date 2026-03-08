import axios, { AxiosError, type AxiosInstance } from 'axios'

import type {
	AccessTokenResponse,
	AuthCredentials,
	AuthTokens,
	RefreshTokenGrant,
} from './types'

export interface AuthServiceOptions {
	baseUrl: string
	apiVersion?: 'v1' | 'v1.1'
	timeoutMs?: number
	httpClient?: AxiosInstance
}

export interface ShotGridErrorItem {
	id?: string
	status?: number
	code?: number
	title?: string
	detail?: string
	source?: unknown
	meta?: unknown
}

export interface ShotGridErrorResponse {
	errors?: ShotGridErrorItem[]
}

export class AuthServiceError extends Error {
	readonly status?: number
	readonly code?: number
	readonly title?: string
	readonly detail?: string
	readonly cause?: unknown

	constructor(
		message: string,
		options?: {
			status?: number
			code?: number
			title?: string
			detail?: string
			cause?: unknown
		},
	) {
		super(message)
		this.name = 'AuthServiceError'
		this.status = options?.status
		this.code = options?.code
		this.title = options?.title
		this.detail = options?.detail
		this.cause = options?.cause
	}
}

export class AuthService {
	private readonly tokenUrl: string
	private readonly httpClient: AxiosInstance

	constructor(options: AuthServiceOptions) {
		const apiVersion = options.apiVersion ?? 'v1.1'
		const normalizedBaseUrl = AuthService.normalizeBaseUrl(options.baseUrl)
		this.tokenUrl = `${normalizedBaseUrl}/api/${apiVersion}/auth/access_token`

		this.httpClient =
			options.httpClient ??
			axios.create({
				timeout: options.timeoutMs ?? 15_000,
			})
	}

	async authenticate(credentials: AuthCredentials): Promise<AuthTokens> {
		return this.requestAccessToken(credentials)
	}

	async refresh(refreshToken: string): Promise<AuthTokens> {
		const grant: RefreshTokenGrant = {
			grantType: 'refresh_token',
			refreshToken,
		}
		return this.requestAccessToken(grant)
	}

	private async requestAccessToken(
		credentials: AuthCredentials | RefreshTokenGrant,
	): Promise<AuthTokens> {
		const payload = this.toFormPayload(credentials)

		try {
			const response = await this.httpClient.post<AccessTokenResponse>(
				this.tokenUrl,
				payload,
				{
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				},
			)

			if (!AuthService.isAccessTokenResponse(response.data)) {
				throw new AuthServiceError('ShotGrid token response format is invalid.')
			}

			return AuthService.toAuthTokens(response.data)
		} catch (error) {
			throw AuthService.toAuthServiceError(error)
		}
	}

	private toFormPayload(
		credentials: AuthCredentials | RefreshTokenGrant,
	): URLSearchParams {
		const form = new URLSearchParams()

		switch (credentials.grantType) {
			case 'client_credentials':
				form.set('grant_type', 'client_credentials')
				form.set('client_id', credentials.clientId)
				form.set('client_secret', credentials.clientSecret)
				if (credentials.scope) {
					form.set('scope', credentials.scope)
				}
				if (credentials.sessionUuid) {
					form.set('session_uuid', credentials.sessionUuid)
				}
				return form

			case 'password':
				form.set('grant_type', 'password')
				form.set('username', credentials.username)
				form.set('password', credentials.password)
				if (credentials.authToken) {
					form.set('auth_token', credentials.authToken)
				}
				if (credentials.scope) {
					form.set('scope', credentials.scope)
				}
				if (credentials.sessionUuid) {
					form.set('session_uuid', credentials.sessionUuid)
				}
				return form

			case 'session_token':
				form.set('grant_type', 'session_token')
				form.set('session_token', credentials.sessionToken)
				return form

			case 'refresh_token':
				form.set('grant_type', 'refresh_token')
				form.set('refresh_token', credentials.refreshToken)
				return form
		}
	}

	private static toAuthTokens(response: AccessTokenResponse): AuthTokens {
		const issuedAt = Date.now()
		const expiresAt = issuedAt + response.expires_in * 1000

		return {
			tokenType: response.token_type,
			accessToken: response.access_token,
			refreshToken: response.refresh_token,
			expiresIn: response.expires_in,
			issuedAt,
			expiresAt,
		}
	}

	private static normalizeBaseUrl(baseUrl: string): string {
		return baseUrl.replace(/\/+$/, '')
	}

	private static isAccessTokenResponse(
		value: unknown,
	): value is AccessTokenResponse {
		if (!value || typeof value !== 'object') {
			return false
		}

		const candidate = value as Partial<AccessTokenResponse>
		return (
			typeof candidate.token_type === 'string' &&
			typeof candidate.access_token === 'string' &&
			typeof candidate.expires_in === 'number' &&
			typeof candidate.refresh_token === 'string'
		)
	}

	private static toAuthServiceError(error: unknown): AuthServiceError {
		if (error instanceof AuthServiceError) {
			return error
		}

		if (error instanceof AxiosError) {
			const status = error.response?.status
			const errorPayload = error.response?.data as ShotGridErrorResponse | undefined
			const firstError = errorPayload?.errors?.[0]

			const detail = firstError?.detail
			const title = firstError?.title
			const code = firstError?.code

			const message =
				detail || title || error.message || 'ShotGrid authentication failed.'

			return new AuthServiceError(message, {
				status,
				code,
				title,
				detail,
				cause: error,
			})
		}

		return new AuthServiceError('Unexpected authentication error.', {
			cause: error,
		})
	}
}
