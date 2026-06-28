import { FetchResult } from "./types"

export interface Collector {
  collect(): Promise<FetchResult>
}