import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import IntroBuilderModal from './IntroBuilderModal';

describe('IntroBuilderModal', () => {
  it('pre-fills the message from the member profile', () => {
    const html = renderToStaticMarkup(
      <IntroBuilderModal initialName="Sipho" initialLinkedin="linkedin.com/in/sipho" initialAreas={['SOC']} introApproved={false} onClose={() => {}} />
    );
    expect(html).toContain("Hi everyone, I&#x27;m Sipho.");
    expect(html).toContain('I&#x27;m focusing on SOC.');
    expect(html).toContain('linkedin.com/in/sipho');
    expect(html).toContain('until Lesedi approves it');
  });
  it('tells the member once Lesedi has approved the intro', () => {
    const html = renderToStaticMarkup(<IntroBuilderModal introApproved onClose={() => {}} />);
    expect(html).toContain('Lesedi has approved your intro');
  });
});
