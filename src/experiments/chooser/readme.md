## The Chooser
The chooser is a fun tool that allows user to crossfade to music tracks while scaling up images up or down


#### Usage

```
  // Chooser usage
  useChooser(
    isOpen ? (btn1Ref as React.RefObject<HTMLElement>) : ({ current: null } as unknown as React.RefObject<HTMLElement>),
    isOpen ? (btn2Ref as React.RefObject<HTMLElement>) : ({ current: null } as unknown as React.RefObject<HTMLElement>),
    {
      leftAudioUrl: '/sounds/chooser/CRAB PIMPZ.m4a',
      rightAudioUrl: '/sounds/chooser/SoftBoys_PatagoniaFleeceMix.m4a',
      stageRef: isOpen ? (exportContainerRef as React.RefObject<HTMLElement>) : ({ current: null } as unknown as React.RefObject<HTMLElement>),
      radius: 100,
      minScale: 1,
      midScale: 1.2,
      maxScale: 1.5,
      curve: 'ease',
      transformMode: 'replace',
      startOnFirstInteraction: true
    }
  );
  ```