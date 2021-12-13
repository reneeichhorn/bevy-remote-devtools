import { Checkbox, FormControl, Grid, Input, InputAdornment, Typography} from '@mui/material';
import React from 'react';
import { Component, parseRustTypeGenerics } from "./serialization";

interface PropertyProps<T> {
  value: T,
  generics?: string,
}

function BoolProperty({ value }: PropertyProps<boolean>): React.ReactElement {
  return (
    <Checkbox size="small" checked={value} sx={{ padding: 0 }} disabled />
  );
}

function VectorProperty({ value }: PropertyProps<number[] | number>): React.ReactElement {
  const arrayValue = Array.isArray(value) ? value : [value];
  return (
    <Grid container direction="row">
      {arrayValue.map((vectorComponent, i) => (
        <Grid item key={i} sx={{ width: '25%' }}>
          <FormControl fullWidth sx={{ margin: 0, width: '100%'}} variant="standard">
            <Input
              type="number"
              value={vectorComponent} 
              startAdornment={
                arrayValue.length > 1 ? (
                  <InputAdornment position="start">
                    {arrayValue.length > 4 ? i : ['X','Y','Z','W'][i]}
                  </InputAdornment>
                ) : null
              }
              fullWidth
              disabled
            />
          </FormControl>
        </Grid>
      ))}
    </Grid>
  );
}

function StringProperty({ value }: PropertyProps<string>): React.ReactElement {
  return (
    <FormControl fullWidth sx={{ margin: 0 }} variant="standard">
      <Input
        value={value} 
        fullWidth
        disabled
      />
    </FormControl>
  );
}

function OptionProperty({ value, generics }: PropertyProps<unknown>): React.ReactElement {
  if (!value) {
    return (
      <Typography color="GrayText">
        None
      </Typography>
    );
  }

  return (
    <TypeRenderer value={value} type={generics} />
  );
}

const COMPONENT_TYPE_MAP = {
  'bool': BoolProperty,
  'f32': VectorProperty,
  'core::option::Option': OptionProperty,
  'alloc::string::String': StringProperty,
  'glam::mat2::Mat2': VectorProperty,
  'glam::mat3::Mat3': VectorProperty,
  'glam::mat4::Mat4': VectorProperty,
  'glam::vec2::Vec2': VectorProperty,
  'glam::vec3::Vec3': VectorProperty,
  'glam::vec4::Vec4': VectorProperty,
  'glam::quat::Quat': VectorProperty,
};

interface TypeRendererProps {
  type: string;
  value: unknown;
}

function TypeRenderer({ type, value}: TypeRendererProps): React.ReactElement {
  const rustType = parseRustTypeGenerics(type);
  const TypeComponent = COMPONENT_TYPE_MAP[rustType.component];
  if (!TypeComponent) {
    return (
      <Typography color="GrayText">
        Unsupported component type ({type})
      </Typography>
    );
  }

  return <TypeComponent value={value} generics={rustType.generics} />
}

interface PropertyViewProps {
  type: string;
  name: string;
  value: unknown;
}

function PropertyView({ type, name, value }: PropertyViewProps): React.ReactElement {
  return (
    <Grid container sx={{ marginBottom: 0.5 }}>
      <Grid item xs={4}>
        <Typography>{name}</Typography>
      </Grid>
      <Grid container item xs={8} alignItems="flex-end">
        <TypeRenderer type={type} value={value} />
      </Grid>
    </Grid>
  );
}

interface StructMember {
  type: string;
  value: unknown;
}

function StructView(props: Record<string, StructMember>): React.ReactElement {
  const properties = Object.entries(props);

  return (
    <Grid container direction="column">
      {properties.map(([name, props]) => (
        <PropertyView key={name} name={name} type={props.type} value={props.value} />
      ))}
    </Grid>
  );
}

interface ComponentProps {
  component: Component;
}

export function ComponentView({ component }: ComponentProps): React.ReactElement {
  return (
    <>
      <Typography color="primary" variant="h6" sx={{ marginBottom: 1 }}>
        {component.type}
      </Typography>
      {component.struct ? (
        <StructView {...component.struct} />
      ) : null}
    </>
  );
}