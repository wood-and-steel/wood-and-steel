import React from "react";
import { getAvatarTextColor, getPlayerInitials } from "../utils/playerAvatar";

export interface PlayerAvatarProps {
  name: string;
  avatarColor: string;
  title?: string;
  isCurrentTurn?: boolean;
}

/**
 * Circular avatar showing one or two initials on a per-player background color.
 */
export function PlayerAvatar({
  name,
  avatarColor,
  title,
  isCurrentTurn = false,
}: PlayerAvatarProps): React.ReactElement {
  const initials = getPlayerInitials(name);
  const textColor = getAvatarTextColor(avatarColor);

  return (
    <span
      className={`playerAvatar${isCurrentTurn ? " playerAvatar--currentTurn" : ""}`}
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
