import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { recreationalPools } from '../content/pages/poolTypes';

export default function RecreationalSwimmingPools() {
  return (
    <PoolTypePage
      schema={recreationalPools}
      poolType="recreational"
      poolName="Recreational Pools"
      gallery={POOL_GALLERIES.recreational}
      layout="narrow"
    />
  );
}
