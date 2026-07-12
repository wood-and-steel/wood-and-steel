import React from "react";
import { getAvatarTextColor, getPlayerInitials } from "../utils/playerAvatar";

export interface PlayerAvatarProps {
  name: string;
  avatarColor: string;
  title?: string;
}

/**
 * Circular avatar showing one or two initials on a per-player background color.
 */
export function PlayerAvatar({ name, avatarColor, title }: PlayerAvatarProps): React.ReactElement {
  const initials = getPlayerInitials(name);
  const textColor = getAvatarTextColor(avatarColor);

  return (
    <span
      className="playerAvatar"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      title={title}
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
