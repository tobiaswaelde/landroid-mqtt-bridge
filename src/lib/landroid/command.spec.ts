import { createMowerCommand, parseMowerCommand } from './command';

describe('parseMowerCommand', () => {
  it('maps documented string command names to vendor codes', () => {
    expect(parseMowerCommand('{"cmd":"start"}')).toEqual({ cmd: 1 });
    expect(parseMowerCommand('{"cmd":"home"}')).toEqual({ cmd: 3 });
    expect(parseMowerCommand('{"cmd":"stop","duration":2}')).toEqual({ cmd: 2, duration: 2 });
  });

  it('rejects numeric, missing, and unknown command names', () => {
    expect(() => parseMowerCommand('{"cmd":1}')).toThrow('Unknown Landroid command: 1.');
    expect(() => parseMowerCommand('{}')).toThrow('Unknown Landroid command: undefined.');
    expect(() => parseMowerCommand('{"cmd":"dance"}')).toThrow('Unknown Landroid command: dance.');
  });
});

describe('createMowerCommand', () => {
  it('adds cloud metadata without replacing an explicit vendor command', () => {
    const command = createMowerCommand('serial-1', 'en', { cmd: 3, custom: true }, new Date(2026, 0, 2, 3, 4, 5));

    expect(command).toMatchObject({
      cmd: 3,
      custom: true,
      dt: '02/01/2026',
      lg: 'en',
      sn: 'serial-1',
      tm: '03:04:05',
    });
    expect(command.id).toEqual(expect.any(Number));
  });
});
