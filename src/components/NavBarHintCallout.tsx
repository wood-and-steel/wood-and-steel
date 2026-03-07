import React from "react";

export interface HintPositionDesktop {
  contentTop: number;
  contentLeft: number;
}

export interface HintPositionMobile {
  contentBottom: number;
}

export interface NavBarHintCalloutProps {
  isDesktop: boolean;
  hintPosition: HintPositionDesktop | HintPositionMobile;
  children: React.ReactNode;
}

/**
 * Positioned callout (rectangle only) for the railroad hint and similar hints in the nav bar.
 * Positioning is dynamic (from measured tab rect); styles are applied inline for top/left/bottom.
 */
export function NavBarHintCallout({
  isDesktop,
  hintPosition,
  children,
}: NavBarHintCalloutProps): React.ReactElement {
  return (
    <div
      className={`navBar__hintCallout ${isDesktop ? "navBar__hintCallout--desktop" : ""}`}
      style={
        isDesktop && "contentTop" in hintPosition
          ? { top: hintPosition.contentTop, left: hintPosition.contentLeft }
          : "contentBottom" in hintPosition
            ? { bottom: hintPosition.contentBottom }
            : undefined
      }
    >
      <div className="navBar__hintCallout__content">{children}</div>
    </div>
  );
}
