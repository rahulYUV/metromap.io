import { Container } from "pixi.js";
import { Label } from "./Label";

/**
 * Global footer with author and GitHub links, positioned at screen corners.
 */
export class Footer extends Container {
  private leftLabel: Label;
  private rightLabel: Label;

  constructor(options?: { githubUrl?: string; authorUrl?: string }) {
    super();

    const githubUrl = options?.githubUrl ??
      "https://github.com/championswimmer/metromap.io";
    const authorUrl = options?.authorUrl ??
      "https://x.com/championswimmer";

    // Left: Author credit
    this.leftLabel = new Label({
      text: "made by championswimmer with Claude/Gemini/Codex",
      style: {
        fontSize: 16,
        fill: 0xaaaaaa,
        fontFamily: "monospace",
      },
    });
    this.leftLabel.anchor.set(0, 1); // bottom-left
    this.leftLabel.alpha = 0.9;
    this.leftLabel.eventMode = "static";
    this.leftLabel.cursor = "pointer";
    this.leftLabel.on("pointerdown", () => {
      window.open(authorUrl, "_blank");
    });
    this.leftLabel.on("pointerover", () => {
      this.leftLabel.alpha = 1.0;
    });
    this.leftLabel.on("pointerout", () => {
      this.leftLabel.alpha = 0.9;
    });
    this.addChild(this.leftLabel);

    // Right: GitHub source link
    this.rightLabel = new Label({
      text: "source on github",
      style: {
        fontSize: 16,
        fill: 0x88ccff,
        fontFamily: "monospace",
      },
    });
    this.rightLabel.anchor.set(1, 1); // bottom-right
    this.rightLabel.alpha = 0.95;
    this.rightLabel.eventMode = "static";
    this.rightLabel.cursor = "pointer";
    this.rightLabel.on("pointerdown", () => {
      window.open(githubUrl, "_blank");
    });
    this.rightLabel.on("pointerover", () => {
      this.rightLabel.alpha = 1.0;
    });
    this.rightLabel.on("pointerout", () => {
      this.rightLabel.alpha = 0.95;
    });
    this.addChild(this.rightLabel);
  }

  /** Position footer elements at the bottom corners */
  public resize(width: number, height: number) {
    const margin = 8;
    this.leftLabel.position.set(margin, height - margin);
    this.rightLabel.position.set(width - margin, height - margin);
  }
}
