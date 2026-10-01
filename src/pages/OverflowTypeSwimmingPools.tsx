import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { overflowPools } from '../content/pages/poolTypes';

export default function OverflowTypeSwimmingPools() {
  return (
    <PoolTypePage
      schema={overflowPools}
      poolType="overflow"
      poolName="Overflow Design Pools"
      gallery={POOL_GALLERIES.overflow}
      layout="wide"
    />
  );
}
