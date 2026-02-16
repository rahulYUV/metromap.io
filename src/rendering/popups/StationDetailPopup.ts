/**
 * Station Detail Popup
 * Shows aggregated passenger information for a specific station
 */

import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { Station } from "@core/game/models/Station";
import { Label } from "@rendering/components/Label";
import { RoundedBox } from "@rendering/components/RoundedBox";
import { FlatButton } from "@rendering/components/FlatButton";
import { engine } from "@app/getEngine";

interface DestinationData {
  stationId: string;
  count: number;
}

// Store the current station to display (set before showing popup)
let currentStation: Station | null = null;
let allStations: Station[] = [];

export function setStationForPopup(
  station: Station,
  stations: Station[],
): void {
  currentStation = station;
  allStations = stations;
}

export class StationDetailPopup extends Container {
  private bg: Sprite;
  private panel: Container;
  private panelBase: RoundedBox;
  private title: Text;
  private closeButton: FlatButton;
  private tableContainer: Container;

  private station: Station;

  constructor() {
    super();

    // Get station from global reference
    if (!currentStation) {
      throw new Error("Station not set for popup");
    }
    this.station = currentStation;

    // Semi-transparent background
    this.bg = new Sprite(Texture.WHITE);
    this.bg.tint = 0x000000;
    this.bg.alpha = 0.7;
    this.bg.interactive = true;
    this.bg.on("pointertap", () => this.close());
    this.addChild(this.bg);

    // Panel container
    this.panel = new Container();
    this.addChild(this.panel);

    // Panel background
    this.panelBase = new RoundedBox({
      width: 500,
      height: 400,
      color: 0x2c3e50,
    });
    this.panel.addChild(this.panelBase);

    // Title
    this.title = new Label({
      text: `Station ${this.station.label}`,
      style: {
        fill: 0xffffff,
        fontSize: 32,
        fontWeight: "bold",
      },
    });
    this.title.anchor.set(0.5);
    this.title.y = -this.panelBase.boxHeight * 0.5 + 40;
    this.panel.addChild(this.title);

    // Subtitle - total waiting
    const totalWaiting = this.station.passengers.length;
    const subtitle = new Label({
      text: `${totalWaiting} passenger${totalWaiting !== 1 ? "s" : ""} waiting`,
      style: {
        fill: 0xaaaaaa,
        fontSize: 18,
      },
    });
    subtitle.anchor.set(0.5);
    subtitle.y = -this.panelBase.boxHeight * 0.5 + 75;
    this.panel.addChild(subtitle);

    // Table container
    this.tableContainer = new Container();
    this.tableContainer.y = -this.panelBase.boxHeight * 0.5 + 110;
    this.panel.addChild(this.tableContainer);

    this.renderTable();

    // Close button
    this.closeButton = new FlatButton({
      text: "Close",
      width: 120,
      height: 45,
      fontSize: 18,
      backgroundColor: 0x3498db,
    });
    this.closeButton.y = this.panelBase.boxHeight * 0.5 - 60;
    this.closeButton.onPress.connect(() => this.close());
    this.panel.addChild(this.closeButton);
  }

  /**
   * Render the destination table
   */
  private renderTable(): void {
    // Aggregate passengers by destination
    const destinationMap = new Map<string, number>();

    for (const passenger of this.station.passengers) {
      const dest = passenger.destinationStationId;
      destinationMap.set(dest, (destinationMap.get(dest) || 0) + 1);
    }

    // Convert to sorted array
    const destinations: DestinationData[] = Array.from(
      destinationMap.entries(),
    ).map(([stationId, count]) => ({ stationId, count }));

    // Sort by count (descending)
    destinations.sort((a, b) => b.count - a.count);

    // Render table header
    const headerY = 0;
    const headerBg = new Graphics();
    headerBg.rect(-220, headerY, 440, 35);
    headerBg.fill(0x34495e);
    this.tableContainer.addChild(headerBg);

    const destHeader = new Label({
      text: "Destination",
      style: {
        fill: 0xffffff,
        fontSize: 16,
        fontWeight: "bold",
      },
    });
    destHeader.anchor.set(0, 0.5);
    destHeader.position.set(-210, headerY + 17);
    this.tableContainer.addChild(destHeader);

    const countHeader = new Label({
      text: "Passengers",
      style: {
        fill: 0xffffff,
        fontSize: 16,
        fontWeight: "bold",
      },
    });
    countHeader.anchor.set(1, 0.5);
    countHeader.position.set(210, headerY + 17);
    this.tableContainer.addChild(countHeader);

    // Render rows
    let rowY = headerY + 35;
    const maxRows = 8; // Limit visible rows
    const visibleDestinations = destinations.slice(0, maxRows);

    for (let i = 0; i < visibleDestinations.length; i++) {
      const dest = visibleDestinations[i];

      // Find the station to get its label
      const destStation = allStations.find((s) => s.id === dest.stationId);
      const destLabel = destStation
        ? `Station ${dest.stationId} (${destStation.label})`
        : `Station ${dest.stationId}`;

      // Alternating row background
      const rowBg = new Graphics();
      rowBg.rect(-220, rowY, 440, 30);
      rowBg.fill(i % 2 === 0 ? 0x2c3e50 : 0x34495e);
      this.tableContainer.addChild(rowBg);

      // Destination label
      const destLabelText = new Label({
        text: destLabel,
        style: {
          fill: 0xecf0f1,
          fontSize: 14,
        },
      });
      destLabelText.anchor.set(0, 0.5);
      destLabelText.position.set(-210, rowY + 15);
      this.tableContainer.addChild(destLabelText);

      // Count label
      const countLabel = new Label({
        text: dest.count.toString(),
        style: {
          fill: 0x3498db,
          fontSize: 14,
          fontWeight: "bold",
        },
      });
      countLabel.anchor.set(1, 0.5);
      countLabel.position.set(210, rowY + 15);
      this.tableContainer.addChild(countLabel);

      rowY += 30;
    }

    // Show "and X more" if there are hidden rows
    if (destinations.length > maxRows) {
      const remaining = destinations.length - maxRows;
      const moreLabel = new Label({
        text: `... and ${remaining} more destination${remaining !== 1 ? "s" : ""}`,
        style: {
          fill: 0x95a5a6,
          fontSize: 12,
          fontStyle: "italic",
        },
      });
      moreLabel.anchor.set(0.5, 0);
      moreLabel.position.set(0, rowY + 5);
      this.tableContainer.addChild(moreLabel);
    }

    // Show empty state if no passengers
    if (destinations.length === 0) {
      const emptyLabel = new Label({
        text: "No passengers waiting",
        style: {
          fill: 0x7f8c8d,
          fontSize: 16,
          fontStyle: "italic",
        },
      });
      emptyLabel.anchor.set(0.5, 0);
      emptyLabel.position.set(0, 20);
      this.tableContainer.addChild(emptyLabel);
    }
  }

  /**
   * Close the popup
   */
  private close(): void {
    engine().navigation.dismissPopup();
  }

  /**
   * Called when the popup is shown
   */
  public async show(): Promise<void> {
    this.resize();
  }

  /**
   * Resize handler
   */
  public resize(): void {
    const width = engine().renderer.width;
    const height = engine().renderer.height;

    // Background fills the screen
    this.bg.width = width;
    this.bg.height = height;

    // Center the panel
    this.panel.x = width / 2;
    this.panel.y = height / 2;
  }
}
