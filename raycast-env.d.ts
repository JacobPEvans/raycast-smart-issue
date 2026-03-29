/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** GitHub Token - Personal access token with 'repo' scope */
  "githubToken": string,
  /** GitHub Organization/User - Your GitHub username or org for fetching repos */
  "githubOrg": string,
  /** LLM Server URL - Local LLM inference endpoint (OpenAI-compatible) */
  "llmUrl": string,
  /** AI Model - Model for issue generation */
  "model": string,
  /** Fallback Model - Used when primary model is unavailable (empty = auto-detect) */
  "fallbackModel": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `create-issue` command */
  export type CreateIssue = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `create-issue` command */
  export type CreateIssue = {}
}

