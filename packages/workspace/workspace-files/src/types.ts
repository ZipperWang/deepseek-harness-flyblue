/** Client-safe workspace file identifiers and projections. */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Identifies the version read by a browser editor. */
export type FileVersion = Branded<'FileVersion'>

/**
 * Creates a compile-time file version brand.
 * @param value - Serialized file metadata version.
 * @returns The value branded for version-checked file APIs.
 */
export const FileVersion = (value: string): FileVersion => value as FileVersion

/** A browser-visible entry under a workspace root. */
export interface WorkspaceFileEntry {
  path: string
  name: string
  directory: boolean
  size: number
  version: FileVersion
}

/** Browser preview of a text file. */
export interface WorkspaceFilePreview {
  path: string
  content: string
  truncated: boolean
  version: FileVersion
}
