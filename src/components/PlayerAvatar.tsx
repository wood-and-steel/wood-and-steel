import React from "react";
import { getAvatarTextColor, getPlayerInitials } from "../utils/playerAvatar";

export interface PlayerAvatarProps {
  name: string;
  avatarColor: string;
  title?: string;
  isCurrentTurn?: boolean;
}

/**
 * Rounded-tile avatar showing one or two initials on a per-player background color. The colors are
 * `--avatar-bg` and `--avatar-text`, set from a ref (no inline styles; see docs/CSS_ARCHITECTURE.md).
 */
export function PlayerAvatar({
  name,
  avatarColor,
  title,
  isCurrentTurn = false,
}: PlayerAvatarProps): React.ReactElement {
  const initials = getPlayerInitials(name);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    ref.current?.style.setProperty("--avatar-bg", avatarColor);
    ref.current?.style.setProperty("--avatar-text", getAvatarTextColor(avatarColor));
  }, [avatarColor]);

  return (
    <span
      ref={ref}
      className={`playerAvatar${isCurrentTurn ? " playerAvatar--currentTurn" : ""}`}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      title={title}
    >
      {initials}
    </span>
  );
}
