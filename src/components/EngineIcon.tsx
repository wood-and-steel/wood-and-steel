import React from "react";
import engineIconSvg from "../shared/assets/images/engine-icon.svg?raw";
import engineSegmentsSvg from "../shared/assets/images/engine-segments.svg?raw";
import type { EngineSlot } from "../rules/playerBoard";
import { getPlayerAvatarColor, getPlayerLightColor } from "../utils/playerAvatar";

export interface EngineIconProps {
  /** The engine token's color: the player's light or dark color. */
  color: string;
  /** Read out in place of the picture, e.g. "Light engine". */
  label: string;
}

/**
 * The engine picture in one of the player's token colors. The SVG is inlined so its body can
 * take `--engine-icon-color`, set from a ref (no inline styles; see docs/CSS_ARCHITECTURE.md).
 */
export function EngineIcon({ color, label }: EngineIconProps): React.ReactElement {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    ref.current?.style.setProperty("--engine-icon-color", color);
  }, [color]);
  return (
    <span
      ref={ref}
      className="engineIcon"
      role="img"
      aria-label={label}
      // A static asset from the repo, not user input.
      dangerouslySetInnerHTML={{ __html: engineIconSvg }}
    />
  );
}

export const ENGINE_SLOT_NAMES: Record<EngineSlot, string> = { 0: "Light", 1: "Dark" };

/** The color of a player's light (slot 0) or dark (slot 1) engine token. */
export function engineSlotColor(playerID: string, avatarColor: string | undefined, slot: EngineSlot): string {
  const dark = getPlayerAvatarColor(playerID, avatarColor);
  return slot === 0 ? getPlayerLightColor(dark) : dark;
}

export interface EngineSlotIconProps {
  playerID: string;
  avatarColor?: string;
  slot: EngineSlot;
  /** Read out in place of the picture; "Light" or "Dark" by default. */
  label?: string;
}

/** The engine picture for one of a player's two engine tokens, in that token's color. */
export function EngineSlotIcon({ playerID, avatarColor, slot, label }: EngineSlotIconProps): React.ReactElement {
  return <EngineIcon color={engineSlotColor(playerID, avatarColor, slot)} label={label ?? ENGINE_SLOT_NAMES[slot]} />;
}

/** The segments picture with its dots in the text color, so it shows in dark mode too. */
const ENGINE_SEGMENTS_SVG = engineSegmentsSvg.replace(/#2C2C2C/gi, "currentColor");

/** An engine's distance: the number, then the segments picture (read out as "3 segments"). */
export function EngineSegments({ count }: { count: number }): React.ReactElement {
  return (
    <span className="engineSegments">
      {count}
      <span
        className="engineSegments__icon"
        role="img"
        aria-label={count === 1 ? " segment" : " segments"}
        // A static asset from the repo, not user input.
        dangerouslySetInnerHTML={{ __html: ENGINE_SEGMENTS_SVG }}
      />
    </span>
  );
}
