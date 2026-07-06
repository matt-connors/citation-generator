// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CitationSearch from '../../src/components/react/CitationSearch';

describe('CitationSearch More menu', () => {
  // globals are off, so testing-library's auto-cleanup never registers
  afterEach(cleanup);
  it('renders the two base tabs plus an icon-only More tab', () => {
    render(<CitationSearch />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Website', 'Book', 'More source types']);
  });

  it('serves Journal from the menu with its DOI submit path', () => {
    render(<CitationSearch />);
    fireEvent.click(screen.getAllByRole('tab')[2]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Journal' }));
    const input = screen.getByPlaceholderText('Enter a DOI') as HTMLInputElement;
    expect(input.name).toBe('journal');
  });

  it('defaultSourceType opens on the matching source type', () => {
    render(<CitationSearch defaultSourceType="youtube" />);
    const moreTab = screen.getAllByRole('tab')[2];
    expect(moreTab.getAttribute('aria-selected')).toBe('true');
    expect(moreTab.textContent).toContain('YouTube');
    const input = screen.getByPlaceholderText('Paste the video URL') as HTMLInputElement;
    expect(input.name).toBe('website');
  });

  it("legacy defaultTab='journal' maps to the Journal source type", () => {
    render(<CitationSearch defaultTab="journal" />);
    expect(screen.getAllByRole('tab')[2].textContent).toContain('Journal');
    const input = screen.getByPlaceholderText('Enter a DOI') as HTMLInputElement;
    expect(input.name).toBe('journal');
  });

  it('opens the menu on More click and activates the chosen source type', () => {
    const { container } = render(<CitationSearch />);
    fireEvent.click(screen.getAllByRole('tab')[2]);
    const menu = screen.getByRole('menu');
    expect(menu).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: 'TikTok' }));
    // Menu closes, More tab becomes the selected "TikTok" tab
    expect(screen.queryByRole('menu')).toBeNull();
    const moreTab = screen.getAllByRole('tab')[2];
    expect(moreTab.getAttribute('aria-selected')).toBe('true');
    expect(moreTab.textContent).toContain('TikTok');

    // The active panel is a website-URL lookup with the TikTok placeholder
    const input = screen.getByPlaceholderText('Paste the TikTok URL') as HTMLInputElement;
    expect(input.name).toBe('website');
    expect(input.disabled).toBe(false);

    // The base Website panel is unmounted (react-tabs only renders the
    // active panel), so its input cannot shadow the More panel's value in
    // the query string
    expect(screen.queryByPlaceholderText('Paste the website URL')).toBeNull();

    // Menu picks are attributed as menu-<key>
    const from = container.querySelector('input[name="from"]') as HTMLInputElement;
    expect(from?.value).toBe('menu-tiktok');

    // The matching guide is offered
    const guideLink = screen.getByRole('link', { name: /How to cite: TikTok/ }) as HTMLAnchorElement;
    expect(guideLink.getAttribute('href')).toBe('/guides/how-to-cite-a-tiktok/');
  });

  it('keeps an explicit from prop over menu attribution', () => {
    const { container } = render(<CitationSearch from="how-to-cite-a-tiktok" />);
    fireEvent.click(screen.getAllByRole('tab')[2]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'YouTube' }));
    const from = container.querySelector('input[name="from"]') as HTMLInputElement;
    expect(from?.value).toBe('how-to-cite-a-tiktok');
  });

  it('does not select the More tab when no source type has been chosen', () => {
    render(<CitationSearch />);
    fireEvent.click(screen.getAllByRole('tab')[2]);
    expect(screen.getAllByRole('tab')[2].getAttribute('aria-selected')).toBe('false');
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');
  });

  it('switching back to a base tab restores its input and unmounts the More panel', () => {
    render(<CitationSearch />);
    fireEvent.click(screen.getAllByRole('tab')[2]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wikipedia' }));
    fireEvent.click(screen.getAllByRole('tab')[0]);
    const baseWebsite = screen.getByPlaceholderText('Paste the website URL') as HTMLInputElement;
    expect(baseWebsite.disabled).toBe(false);
    // The More panel is unmounted once another tab is active
    expect(screen.queryByPlaceholderText('Paste the article URL')).toBeNull();
  });
});
