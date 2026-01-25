import { setEngine } from "./app/getEngine";
import { LoadScreen } from "./app/screens/LoadScreen";
import { MapPickerScreen } from "./app/screens/MapPickerScreen";
import { MetroBuildingScreen } from "./app/screens/MetroBuildingScreen";
import { userSettings } from "./app/utils/userSettings";
import { CreationEngine } from "./engine/engine";
import { hasSavedGame, loadGameState } from "./app/game/models/GameState";

/**
 * Importing these modules will automatically register there plugins with the engine.
 */
import "@pixi/sound";
// import "@esotericsoftware/spine-pixi-v8";

// Create a new creation engine instance
const engine = new CreationEngine();
setEngine(engine);

(async () => {
  // Initialize the creation engine instance
  await engine.init({
    background: "#1E1E1E",
    resizeOptions: { minWidth: 768, minHeight: 1024, letterbox: false },
  });

  // Initialize the user settings
  userSettings.init();

  // Show the load screen
  await engine.navigation.showScreen(LoadScreen);

  // Check if there's a saved game
  if (hasSavedGame()) {
    console.log("Saved game found, loading...");
    const savedState = loadGameState();
    if (savedState) {
      // Go directly to building screen with saved state
      await engine.navigation.showScreen(MetroBuildingScreen);
      const screen = engine.navigation.currentScreen as MetroBuildingScreen;
      if (screen && screen.setGameState) {
        screen.setGameState(savedState);
      }
    } else {
      // Saved game corrupted, go to map picker
      await engine.navigation.showScreen(MapPickerScreen);
    }
  } else {
    // No saved game, show map picker
    await engine.navigation.showScreen(MapPickerScreen);
  }
})();
