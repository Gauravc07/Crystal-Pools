import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { skimmerPools } from '../content/pages/poolTypes';

export default function SkimmerTypeSwimmingPools() {
  return (
    <PoolTypePage
      schema={skimmerPools}
      poolType="skimmer"
      poolName="Skimmer Type Pools"
      gallery={POOL_GALLERIES.skimmer}
      layout="wide"
    />
  );
}
