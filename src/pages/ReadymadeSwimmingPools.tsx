import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { readymadePools } from '../content/pages/poolTypes';

export default function ReadymadeSwimmingPools() {
  return (
    <PoolTypePage
      schema={readymadePools}
      poolType="readymade"
      poolName="Readymade Pools"
      gallery={POOL_GALLERIES.readymade}
      layout="wide"
      checkIcons
    />
  );
}
