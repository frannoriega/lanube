export const REPORT_TYPES = ["RESERVATIONS", "USAGE", "EVENTS"] as const

export type ReportType = (typeof REPORT_TYPES)[number]

export type ReportRequestOptions = Record<string, unknown>

export type ReportRequestItem = {
  type: ReportType
  options: ReportRequestOptions
}

export type ReportWindowRequest = {
  startDate: number
  endDate: number
  reports: ReportRequestItem[]
}
