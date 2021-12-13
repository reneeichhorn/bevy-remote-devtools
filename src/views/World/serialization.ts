export interface Component {
  type: string,
  struct?: Record<string, unknown>,
  tuple_struct?: Record<string, unknown>[],
}

export interface Entity {
  entity: number,
  components: Component[],
}

export interface ListItem<T> {
  type: string,
  value: T,
}

export interface EntityNode {
  entity: number,
  components: Component[],
  children: EntityNode[],
}


export const COMPONENT_CHILDREN_TYPE = 'bevy_transform::components::children::Children';
export const COMPONENT_PARENT_TYPE = 'bevy_transform::components::parent::Parent';
export const COMPONENT_PREVIOUS_PARENT_TYPE = 'bevy_transform::components::parent::PreviousParent';

export const HIERARCHY_COMPONENT_TYPES = [
  COMPONENT_CHILDREN_TYPE,
  COMPONENT_PARENT_TYPE,
  COMPONENT_PREVIOUS_PARENT_TYPE
];

export function parseRustTypePath(ty: string): string[] {
  const pathRegex = /([a-z]+(<[a-z:]*>)?)/gi;
  const matches = ty.match(pathRegex);
  return matches;
}

interface RustTypePath {
  component: string,
  generics?: string,
}

export function parseRustTypeGenerics(ty: string): RustTypePath {
  const pathRegex = /([a-z:0-9]*)(<[a-z:0-9<>,]*>)/gi
  const matches = pathRegex.exec(ty);
  if (!matches) {
    return {
      component: ty,
      generics: '',
    };
  }
  console.warn('mat', matches);
  return {
    component: matches[1],
    generics: matches[2].slice(1, matches[2].length - 1),
  }
}

export function unflattenEntities(entities: Entity[]): EntityNode[] {
  // Build hashmap with all entity ids.
  const mapEntities = new Map<number, Entity>();
  for (const entity of entities) {
    mapEntities.set(entity.entity, entity);
  }

  const childRelations = new Map<number, number[]>();

  const roots = entities.map((entity) => {
    const childrenComponent = entity.components.find(
      component => component.type === COMPONENT_CHILDREN_TYPE
    );
    if (childrenComponent) {
      const list = childrenComponent.tuple_struct[0].list as ListItem<number>[];
      childRelations.set(entity.entity, list.map(l => l.value));
    }

    const parentComponent = entity.components.find(
      component => component.type === COMPONENT_PARENT_TYPE
    );
    if (parentComponent) {
      return null;
    }
    return entity.entity;
  }).filter(e => e !== null);

  function createEntityNode(id: number): EntityNode {
    const entity = mapEntities.get(id);
    const children = childRelations.get(id);
    return {
      ...entity,
      children: children?.map(id => createEntityNode(id)) || [],
    };
  }

  return roots.map(id => createEntityNode(id));
}