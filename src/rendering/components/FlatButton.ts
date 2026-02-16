/**
 * Simple flat SVG-style button with press animation
 * No sprite dependencies, just simple Graphics rendering
 */

import { Graphics, Text } from "pixi.js";
import { FancyButton } from "@pixi/ui";

import { engine } from "@app/getEngine";

const defaultButtonOptions = {
  text: "",
  width: 100,
  height: 50,
  fontSize: 20,
  backgroundColor: 0x4a90e2,
  textColor: 0xffffff,
  borderRadius: 8,
};

type FlatButtonOptions = typeof defaultButtonOptions;

/**
 * A simple flat button with press animation
 */
export class FlatButton extends FancyButton {
  constructor(options: Partial<FlatButtonOptions> = {}) {
    const opts = { ...defaultButtonOptions, ...options };

    // Create button background graphics
    // Draw from (0, 0) and let FancyButton handle anchoring
    const buttonGraphics = new Graphics();
    buttonGraphics.roundRect(0, 0, opts.width, opts.height, opts.borderRadius);
    buttonGraphics.fill(opts.backgroundColor);

    // Create text
    const buttonText = new Text({
      text: opts.text,
      style: {
        fill: opts.textColor,
        fontSize: opts.fontSize,
        fontWeight: "600",
      },
    });

    super({
      defaultView: buttonGraphics,
      text: buttonText,
      anchor: 0.5,
      textOffset: { x: 0, y: 0 },
      defaultTextAnchor: 0.5,
      animations: {
        hover: {
          props: {
            scale: { x: 1.05, y: 1.05 },
          },
          duration: 100,
        },
        pressed: {
          props: {
            scale: { x: 0.95, y: 0.95 },
          },
          duration: 100,
        },
      },
    });

    this.onDown.connect(this.handleDown.bind(this));
    this.onHover.connect(this.handleHover.bind(this));
  }

  private handleHover() {
    engine().audio.sfx.play("main/sounds/sfx-hover.wav");
  }

  private handleDown() {
    engine().audio.sfx.play("main/sounds/sfx-press.wav");
  }
}
