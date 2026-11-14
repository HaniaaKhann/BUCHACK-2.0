import type { InAppAccuracy } from '@app/core';
import type { SimulatedAccuracy, SimulatedResult } from '@/server/accuracy';
import { Card } from '../primitives';

type Models = SimulatedAccuracy['overall']['trueReady'];

const percent = (rate: number | null): string =>
  rate === null ? 'none' : `${(rate * 100).toFixed(1)}%`;
const minutes = (value: number | null): string => (value === null ? 'none' : value.toFixed(2));

function ModelTable({
  title,
  models,
  names,
}: {
  title: string;
  models: Models;
  names: SimulatedAccuracy['models'];
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] text-left text-sm">
        <caption className="pb-2 text-left text-sm font-semibold">{title}</caption>
        <thead>
          <tr className="border-b border-navy/15 text-xs text-muted">
            <th className="py-1.5 pr-3 font-medium">Model</th>
            <th className="py-1.5 pr-3 font-medium">Orders</th>
            <th className="py-1.5 pr-3 font-medium">Mean error (min)</th>
            <th className="py-1.5 font-medium">Inside the range</th>
          </tr>
        </thead>
        <tbody>
          {names.map((model) => {
            const row = models[model.id];
            return (
              <tr key={model.id} className="border-b border-navy/15">
                <td className="py-1.5 pr-3">{model.name}</td>
                <td className="py-1.5 pr-3" data-value={row.n}>
                  {row.n}
                </td>
                <td className="py-1.5 pr-3" data-value={row.maeMinutes ?? ''}>
                  {minutes(row.maeMinutes)}
                </td>
                <td className="py-1.5" data-value={row.onTimeRate ?? ''}>
                  {percent(row.onTimeRate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SimulatedPanel({ result }: { result: SimulatedResult }): React.JSX.Element {
  if (result.status !== 'ok') {
    return (
      <Card title="Backtest on simulated history">
        <p data-empty="simulated" className="text-sm text-navy">
          {result.status === 'missing'
            ? 'The backtest results file is not available yet.'
            : 'The backtest results file could not be read.'}
        </p>
      </Card>
    );
  }
  const { data } = result;
  return (
    <Card title="Backtest on simulated history">
      <div className="flex flex-col gap-5" data-panel="simulated">
        <p className="text-sm font-medium">
          These numbers come from simulated data, not real canteen measurements.
        </p>
        <p className="text-xs text-muted">
          {data.label}. Seed {data.seed}, model {data.modelVersion}, history from{' '}
          {data.historyStart}. Trained on weeks {data.trainWeeks.join(', ')}, tested on weeks{' '}
          {data.testWeeks.join(', ')}.
        </p>
        <div className="grid gap-6 xl:grid-cols-2">
          <ModelTable
            title="Against the true ready time"
            models={data.overall.trueReady}
            names={data.models}
          />
          <ModelTable
            title="Against the vendor Ready tap"
            models={data.overall.tap}
            names={data.models}
          />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          {data.byWeekType.map((week) => (
            <ModelTable
              key={week.weekType}
              title={`${week.weekType} weeks, true ready time`}
              models={week.trueReady}
              names={data.models}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function InAppPanel({ inApp }: { inApp: InAppAccuracy }): React.JSX.Element {
  return (
    <Card title="Orders placed in this app">
      {inApp.n === 0 ? (
        <p data-empty="in-app" className="text-sm text-navy">
          No completed in-app orders yet. Place an order, then tap Ready on the vendor board, and
          the real numbers will appear here.
        </p>
      ) : (
        <dl className="grid max-w-md grid-cols-3 gap-3 text-sm" data-panel="in-app">
          <div>
            <dt className="text-xs text-muted">Orders</dt>
            <dd className="font-semibold" data-value={inApp.n}>
              {inApp.n}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Mean error (min)</dt>
            <dd className="font-semibold" data-value={inApp.maeMinutes ?? ''}>
              {minutes(inApp.maeMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Inside the range</dt>
            <dd className="font-semibold" data-value={inApp.onTimeRate ?? ''}>
              {percent(inApp.onTimeRate)}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

export function AccuracyView({
  simulated,
  inApp,
}: {
  simulated: SimulatedResult;
  inApp: InAppAccuracy;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <SimulatedPanel result={simulated} />
      <InAppPanel inApp={inApp} />
    </div>
  );
}
