"use client";

import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  type TabListProps as AriaTabListProps,
  type TabPanelProps as AriaTabPanelProps,
  type TabProps as AriaTabProps,
  type TabsProps as AriaTabsProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { cx } from "./cx";

// Spec 0160: envoltorios de React Aria con clases fijas. Flechas cambian de pestaña.
export type TabsProps = Omit<AriaTabsProps, "className" | "children"> & {
  className?: string;
  children: ReactNode;
};

export function Tabs({ className, children, ...props }: TabsProps) {
  return (
    <AriaTabs {...props} className={cx("grid", className)}>
      {children}
    </AriaTabs>
  );
}

export type TabListProps = Omit<
  AriaTabListProps<object>,
  "className" | "children" | "aria-label"
> & { "aria-label": string; children: ReactNode };

export function TabList({ children, ...props }: TabListProps) {
  return (
    <AriaTabList {...props} className="flex gap-1 border-b border-border">
      {children}
    </AriaTabList>
  );
}

export type TabProps = Omit<AriaTabProps, "className" | "children"> & {
  tourAnchor?: string;
  children: ReactNode;
};

export function Tab({ tourAnchor, children, ...props }: TabProps) {
  return (
    <AriaTab
      {...props}
      data-tour={tourAnchor}
      className={({ isSelected, isFocusVisible, isDisabled }) =>
        cx(
          "-mb-px flex min-h-11 cursor-pointer items-center border-b-2 px-4 py-2.5 text-base font-bold outline-none",
          isSelected
            ? "border-primary text-content"
            : "border-transparent text-content-muted",
          isFocusVisible && "outline-2 outline-offset-2 outline-focus",
          isDisabled && "cursor-not-allowed text-content-disabled",
        )
      }
    >
      {children}
    </AriaTab>
  );
}

export type TabPanelProps = Omit<
  AriaTabPanelProps,
  "className" | "children"
> & {
  children: ReactNode;
};

export function TabPanel({ children, ...props }: TabPanelProps) {
  return (
    <AriaTabPanel {...props} className="pt-5 outline-none">
      {children}
    </AriaTabPanel>
  );
}
