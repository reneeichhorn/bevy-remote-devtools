import React, { useMemo, useState } from 'react';
import { Grid, Typography, Button, SvgIcon, SvgIconProps, Card } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import TreeView from '@mui/lab/TreeView';
import TreeItem, { TreeItemProps, treeItemClasses } from '@mui/lab/TreeItem';
import Collapse from '@mui/material/Collapse';
import { useApiRequest } from '../../api';
import { TransitionProps } from '@mui/material/transitions';
import { useSpring, animated } from 'react-spring';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { 
  unflattenEntities,
  EntityNode,
  Entity,
  Component,
  parseRustTypePath,
  HIERARCHY_COMPONENT_TYPES 
} from './serialization';
import { ComponentView } from './Component';

function MinusSquare(props: SvgIconProps) {
  return (
    <SvgIcon fontSize="inherit" style={{ width: 14, height: 14 }} {...props}>
      {/* eslint-disable-next-line max-len */}
      <path d="M22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0zM17.873 11.023h-11.826q-.375 0-.669.281t-.294.682v0q0 .401.294 .682t.669.281h11.826q.375 0 .669-.281t.294-.682v0q0-.401-.294-.682t-.669-.281z" />
    </SvgIcon>
  );
}

function PlusSquare(props: SvgIconProps) {
  return (
    <SvgIcon fontSize="inherit" style={{ width: 14, height: 14 }} {...props}>
      {/* eslint-disable-next-line max-len */}
      <path d="M22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0zM17.873 12.977h-4.923v4.896q0 .401-.281.682t-.682.281v0q-.375 0-.669-.281t-.294-.682v-4.896h-4.923q-.401 0-.682-.294t-.281-.669v0q0-.401.281-.682t.682-.281h4.923v-4.896q0-.401.294-.682t.669-.281v0q.401 0 .682.281t.281.682v4.896h4.923q.401 0 .682.281t.281.682v0q0 .375-.281.669t-.682.294z" />
    </SvgIcon>
  );
}

function CloseSquare() {
  return (
    <DataObjectIcon sx={{ width: 14, height: 14, fontSize: 14 }} />
  );
}

function TransitionComponent(props: TransitionProps) {
  const style = useSpring({
    from: {
      opacity: 0,
      transform: 'translate3d(20px,0,0)',
    },
    to: {
      opacity: props.in ? 1 : 0,
      transform: `translate3d(${props.in ? 0 : 20}px,0,0)`,
    },
  });

  return (
    <animated.div style={style}>
      <Collapse {...props} />
    </animated.div>
  );
}

const StyledTreeItem = styled((props: TreeItemProps) => (
  <TreeItem {...props} TransitionComponent={TransitionComponent} />
))(({ theme }) => ({
  [`& .${treeItemClasses.iconContainer}`]: {
    '& .close': {
      opacity: 0.3,
    },
  },
  [`& .${treeItemClasses.group}`]: {
    marginLeft: 15,
    paddingLeft: 18,
    borderLeft: `1px dashed ${alpha(theme.palette.text.primary, 0.4)}`,
  },
}));

export function renderEntityNode(
  entity: EntityNode,
  setComponent: React.Dispatch<React.SetStateAction<[number, string]>>
): React.ReactElement {
  return (
    <StyledTreeItem 
      key={entity.entity} 
      nodeId={entity.entity.toString()} 
      label={`Entity (${entity.entity})`}
    >
      {entity.components
        .filter(component => !HIERARCHY_COMPONENT_TYPES.includes(component.type))
        .map(component => (
          <StyledTreeItem 
            key={`${entity.entity}-${component.type}`} 
            nodeId={`${entity.entity}-${component.type}`} 
            label={parseRustTypePath(component.type).pop()} 
            onClick={() => setComponent([entity.entity, component.type])}
          />
        ))}
      {entity.children.map(child => (
        renderEntityNode(child, setComponent)
      ))}
    </StyledTreeItem>
  );
}

export function WorldView(): React.ReactElement {
  const { data: entities, refetch: refetchEntities } = useApiRequest<Entity[]>(
    '/v1/world', { method: 'GET' }
  );
  const world = useMemo<EntityNode[]>(() => unflattenEntities(entities || []), [entities]);

  const [activeComponentPath, setActiveComponentPath] = useState<[number, string]>(null);
  const activeComponent = useMemo<Component>(
    () => entities
      ?.find(e => e.entity === activeComponentPath?.[0])
      ?.components
      ?.find(c => c.type === activeComponentPath?.[1]) || null,
    [activeComponentPath, entities]
  );

  return (
    <>
      <Grid container direction="row">
        <Grid item flexGrow={1}>
          <Typography color="primary" variant="h4">Entities</Typography>
        </Grid>
        <Grid item>
          <Button onClick={() => refetchEntities()}>
            Reload
          </Button>
        </Grid>
      </Grid>
      <Card sx={{ padding: 1, marginTop: 2 }}>
        <Grid container>
          <Grid item xs={4}>
            <TreeView
              defaultCollapseIcon={<MinusSquare />}
              defaultExpandIcon={<PlusSquare />}
              defaultEndIcon={<CloseSquare />}
              sx={{ flexGrow: 1, overflowY: 'auto' }}
            >
              {world.map((entity) => (
                renderEntityNode(entity, setActiveComponentPath)
              ))}
            </TreeView>
          </Grid>
          <Grid item xs={8} sx={{ padding: 1 }}>
            {activeComponent ? (
              <ComponentView component={activeComponent} />
            ) : (
              <Typography 
                color="GrayText" 
                variant="h6"
              >
                Click on an component to view its properties.
              </Typography>
            )}
          </Grid>
        </Grid>
      </Card>
    </>
  );
}