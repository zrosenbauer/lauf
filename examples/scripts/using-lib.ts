import { lauf } from 'laufen';

import { formatDate, writeJsonFile } from '../lib/utils.js';

export default lauf({
  description: 'Example script using shared utilities',
  async run(ctx) {
    const data = {
      name: ctx.name,
      date: formatDate(),
      workspace: ctx.dirs.root,
      package: ctx.dirs.package,
    };

    await writeJsonFile('output.json', data);
    ctx.logger.success('Done! Output written to output.json');
  },
});
