/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface FooterProps {
  goHome: () => void;
  setSearchMode: (mode: 'movie' | 'tv') => void;
}

export default function Footer(_props: FooterProps) {
  return (
    <footer className="noir-footer select-none" dir="ltr">
      <p>
        Noir Cinema does not host, upload, or store any files. Titles shown here are indexed
        automatically from public sources and third-party services. The media stays on those
        platforms — we only provide links.
      </p>
    </footer>
  );
}
