import React, { useState } from 'react'
import CssBaseline from '@mui/material/CssBaseline';
import { 
  AppBar,
  createTheme, 
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  styled,
  ThemeProvider,
  Toolbar 
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import MenuIcon from '@mui/icons-material/Menu';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import PublicIcon from '@mui/icons-material/Public';

import { ClientSelect } from './components/ClientSelect';
import { Router } from './components/Router';
import { HashRouter, Link } from 'react-router-dom';
import { ApiProvider } from './api';
import { AssetViewerProvider } from './components/AssetViewer';
import { FrameDiagnostic } from './components/FrameDiagnostic';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const DRAWER_WIDTH = 200;

const StyledDrawer = styled(Drawer)({
  width: DRAWER_WIDTH,
  flexShrink: 0,
});

const DrawerHeader = styled("div")(({theme}) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(1),
  justifyContent: "flex-end",
}));

interface StyledAppBarProps {
  $shifted: boolean;
}

const StyledAppBar = styled(AppBar)<StyledAppBarProps>(({ $shifted, theme }) => ({
  width: $shifted ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
  marginLeft: $shifted ? DRAWER_WIDTH : 0,
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.enteringScreen,
  }),
}));

interface MainProps {
  $shifted: boolean;
}

const Main = styled("main")<MainProps>(({ $shifted, theme }) => ({
  width: $shifted ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
  minHeight: 'calc(100vh - 68px)',
  flexGrow: 1,
  padding: theme.spacing(3),
  marginLeft: $shifted ? DRAWER_WIDTH : 0,
  background: '#2a2a2a',
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.enteringScreen,
  }),
}));

const Root = styled("div")({
  display: 'flex',
  flexDirection: 'column',
});

export function App(): React.ReactElement {
  const [open, setOpen] = useState(true);

  return (
    <HashRouter >
      <ApiProvider>
        <CssBaseline />
        <ThemeProvider theme={darkTheme}>
          <Root>
            <AssetViewerProvider>
              <StyledAppBar position="sticky" $shifted={open}>
                <Toolbar>
                  <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    onClick={() => setOpen(!open)}
                    edge="start"
                    sx={{ display: open ? "hidden" : 'initial'}}
                  >
                    <MenuIcon />
                  </IconButton>
                  <ClientSelect />
                  <FrameDiagnostic />
                </Toolbar>
              </StyledAppBar>

              <StyledDrawer
                variant="persistent"
                anchor="left"
                open={open}
              >
                <DrawerHeader>
                  <IconButton onClick={() => setOpen(!open)}>
                    <ChevronLeftIcon />
                  </IconButton>
                </DrawerHeader>

                <Divider />

                <List>
                  <ListItem button component={Link} to="/">
                    <ListItemIcon>
                      <FormatAlignCenterIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tracing Events" />
                  </ListItem>
                  <Divider />
                  {/*
                  <ListItem button>
                    <ListItemIcon>
                      <AccountTreeIcon />
                    </ListItemIcon>
                    <ListItemText primary="Render Graph" />
                  </ListItem>
                  <ListItem button>
                    <ListItemIcon>
                      <AccountTreeIcon />
                    </ListItemIcon>
                    <ListItemText primary="Schedule Graph" />
                  </ListItem>
                  <Divider />
                  */}
                  <ListItem button component={Link} to="/assets">
                    <ListItemIcon>
                      <ViewInArIcon />
                    </ListItemIcon>
                    <ListItemText primary="Assets" />
                  </ListItem>
                  <ListItem button component={Link} to="/world">
                    <ListItemIcon>
                      <PublicIcon />
                    </ListItemIcon>
                    <ListItemText primary="Entities" />
                  </ListItem>
                  <Divider />
                  <ListItem button component={Link} to="/system-profiler">
                    <ListItemIcon>
                      <AutoGraphIcon/>
                    </ListItemIcon>
                    <ListItemText primary="System Profiler" />
                  </ListItem>
                </List>
              </StyledDrawer>

              <Main $shifted={open}>
                <Router />
              </Main>
            </AssetViewerProvider>
          </Root>
        </ThemeProvider>
      </ApiProvider>
    </HashRouter>
  )
}