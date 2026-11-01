import { attachmentDisposition } from './content-disposition.js';
import { escapeLike } from './escape-like.js';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(escapeLike('plain text')).toBe('plain text');
  });
});

describe('attachmentDisposition', () => {
  it('forces a download and keeps Unicode names intact', () => {
    const header = attachmentDisposition('ảnh "chụp".png');
    expect(header.startsWith('attachment; ')).toBe(true);
    expect(header).toContain('filename="_nh _ch_p_.png"');
    expect(header).toContain(
      `filename*=UTF-8''${encodeURIComponent('ảnh "chụp".png')}`,
    );
  });
});
