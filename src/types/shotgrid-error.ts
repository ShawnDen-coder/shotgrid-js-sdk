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
