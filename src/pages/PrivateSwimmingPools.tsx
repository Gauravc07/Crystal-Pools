import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { privatePools } from '../content/pages/poolTypes';

export default function PrivateSwimmingPools() {
  return (
    <PoolTypePage
      schema={privatePools}
      poolType="private"
      poolName="Private Swimming Pools"
      gallery={POOL_GALLERIES.private}
      layout="narrow"
    />
  );
}
