import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { vanishingEdgePools } from '../content/pages/poolTypes';

export default function VanishingEdgeSwimmingPools() {
  return (
    <PoolTypePage
      schema={vanishingEdgePools}
      poolType="vanishing-edge"
      poolName="Vanishing Edge Pools"
      gallery={POOL_GALLERIES.vanishingEdge}
      layout="wide"
    />
  );
}
