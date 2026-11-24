import React from "react";
import engineIconSvg from "../shared/assets/images/engine-icon.svg?raw";

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
