import React from "react";
import { getAvatarTextColor, getPlayerInitials } from "../utils/playerAvatar";

export interface PlayerAvatarProps {
  name: string;
  avatarColor: string;
}

/**
 * Circular avatar showing one or two initials on a per-player background color.
 */
export function PlayerAvatar({ name, avatarColor }: PlayerAvatarProps): React.ReactElement {
  const initials = getPlayerInitials(name);
  const textColor = getAvatarTextColor(avatarColor);

  return (
    <span
      className="playerAvatar"
      aria-hidden="true"
      style={
        {
          "--avatar-bg": avatarColor,
          "--avatar-text": textColor,
        } as React.CSSProperties
      }
    >
      {initials}
    </span>
  );
}
