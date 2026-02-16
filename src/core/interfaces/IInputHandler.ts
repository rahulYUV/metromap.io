/**
 * Input Handler Interface for MetroMap.io
 * Abstracts user input from the rendering layer.
 * Allows different platforms to implement their own input handling.
 */

import type { Vector2 } from "./types";

/**
 * Types of input events
 */
export type InputEventType =
  | "click"
  | "drag_start"
  | "drag_move"
  | "drag_end"
  | "key";

/**
 * Input event data
 */
export interface InputEvent {
  type: InputEventType;

  // Position for pointer events
  position?: Vector2;

  // Grid vertex position (if applicable)
  vertex?: Vector2;

  // Key for keyboard events
  key?: string;

  // Modifiers
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;

  // For drag events
  startPosition?: Vector2;
  delta?: Vector2;
}

/**
 * Input callback function type
 */
export type InputCallback = (event: InputEvent) => void;

/**
 * Input Handler Interface
 */
export interface IInputHandler {
  /**
   * Subscribe to input events
   * @returns Unsubscribe function
   */
  subscribe(callback: InputCallback): () => void;

  /**
   * Enable input handling
   */
  enable(): void;

  /**
   * Disable input handling
   */
  disable(): void;

  /**
   * Check if input handling is enabled
   */
  isEnabled(): boolean;

  /**
   * Clear all subscribers
   */
  clearSubscribers(): void;

  /**
   * Dispose of the input handler
   */
  dispose(): void;
}
