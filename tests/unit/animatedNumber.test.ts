import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { AnimatedNumber } from '@/components/visual/AnimatedNumber';

/**
 * Die Zahl im Markup muss immer exakt der gepflegte Wert sein.
 *
 * Das Hochzählen ist reine Verzierung: Ohne JavaScript, bei reduzierter
 * Bewegung oder bei nicht-numerischen Werten darf sich nichts ändern – und es
 * darf nie ein Wert entstehen, der so nicht gepflegt wurde.
 */

function propsOf(value: string): Record<string, unknown> {
  const element = AnimatedNumber({ value }) as ReactElement;
  return element.props as Record<string, unknown>;
}

describe('AnimatedNumber', () => {
  it('gibt den gepflegten Wert unverändert aus', () => {
    expect(propsOf("1'200+").children).toBe("1'200+");
    expect(propsOf('viele').children).toBe('viele');
  });

  it('erkennt Zahl, Vor- und Nachtext', () => {
    const props = propsOf('ca. 40 Teams');
    expect(props['data-countup']).toBe(40);
    expect(props['data-countup-prefix']).toBe('ca. ');
    expect(props['data-countup-suffix']).toBe(' Teams');
  });

  it('merkt sich den exakten Endzustand', () => {
    expect(propsOf("1'200+")['data-countup-final']).toBe("1'200+");
    expect(propsOf("1'200+")['data-countup']).toBe(1200);
  });

  it('animiert nichts ohne erkennbare Zahl', () => {
    expect(propsOf('viele')['data-countup']).toBeUndefined();
    expect(propsOf('0')['data-countup']).toBeUndefined();
    expect(propsOf('–')['data-countup']).toBeUndefined();
  });
});
