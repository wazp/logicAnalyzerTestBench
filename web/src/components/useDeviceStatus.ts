import { useEffect, useState } from 'preact/hooks';
import { getStatus, type DeviceStatus } from '../model/device';

export type DeviceState = { loading: true } | { loading: false; status: DeviceStatus | null };

/** The test bench status, fetched on mount and again whenever the tab comes back into view, since the preset
 * or network may have changed from the serial console meanwhile. status is null when the guide is not served by
 * a test bench (opened from a file or another host). */
export function useDeviceStatus(): [DeviceState, () => void] {
  const [state, setState] = useState<DeviceState>({ loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getStatus().then((status) => {
      if (!cancelled) setState({ loading: false, status });
    });
    return () => {
      cancelled = true;
    };
  }, [version]);
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState === 'visible') setVersion((v) => v + 1);
    };
    document.addEventListener('visibilitychange', refetch);
    window.addEventListener('focus', refetch);
    return () => {
      document.removeEventListener('visibilitychange', refetch);
      window.removeEventListener('focus', refetch);
    };
  }, []);
  return [state, () => setVersion((v) => v + 1)];
}
