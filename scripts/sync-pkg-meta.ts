import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

import { lauf } from 'laufen';

const FILES_TO_SYNC: ReadonlyArray<string> = ['README.md', 'LICENSE'];
const TARGET_PACKAGE = 'packages/laufen';

export default lauf({
  description: 'Copy README.md and LICENSE from repo root into packages/laufen for npm publishing',
  args: {},
  async run(ctx) {
    const targetDir = join(ctx.root, TARGET_PACKAGE);

    ctx.spinner.start('Syncing package metadata files...');

    await Promise.all(
      FILES_TO_SYNC.map((file) => copyFile(join(ctx.root, file), join(targetDir, file))),
    );

    ctx.spinner.stop('Package metadata synced');
    FILES_TO_SYNC.map((file) => ctx.logger.success(`Copied ${file} -> ${TARGET_PACKAGE}/${file}`));
  },
});
