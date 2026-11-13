const tick = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
};

const main = async (): Promise<void> => {
  process.stdout.write('[worker] started\n');
  const running = true;
  while (running) {
    await tick();
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`[worker] fatal ${String(err)}\n`);
  process.exit(1);
});
