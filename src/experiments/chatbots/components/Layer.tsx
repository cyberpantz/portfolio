/**
 * A layer over the whole device, above the transcript. Ceremonies and the
 * boss draw here. With no host (server render, tests) it renders in place.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const LayerHost = createContext<HTMLElement | null>(null);

export function Layer({ children }: { children: ReactNode }) {
  const host = useContext(LayerHost);
  return host ? createPortal(children, host) : <>{children}</>;
}
