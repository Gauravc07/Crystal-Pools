import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { commercialPools } from '../content/pages/poolTypes';

export default function CommercialSwimmingPools() {
  return (
    <PoolTypePage
      schema={commercialPools}
      poolType="commercial"
      poolName="Commercial Pools"
      gallery={POOL_GALLERIES.commercial}
      layout="narrow"
    />
  );
}
