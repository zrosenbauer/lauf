import { lauf } from 'laufen';

export default lauf({
  description: 'Demonstrate script-level package management',
  // Script-specific packages are installed to a cache and available via dynamic import
  packages: {
    chalk: '^5.0.0',
    'ora': '^8.0.0',
  },
  async run(ctx) {
    // Dynamic imports work because packages are in NODE_PATH
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;

    ctx.logger.info(chalk.blue('This text is styled with chalk!'));
    ctx.logger.info(chalk.green('Packages are installed to ~/.lauf/packages/<hash>/'));
    ctx.logger.newlines();

    const spinner = ora('Working...').start();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    spinner.succeed(chalk.green('Done!'));

    ctx.logger.newlines();
    ctx.logger.success(
      'Script-level packages override workspace packages for version conflicts',
    );
  },
});
