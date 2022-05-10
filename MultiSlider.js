import React from 'react';

import {
  StyleSheet,
  PanResponder,
  View,
  Text,
  Platform,
  I18nManager,
  ImageBackground,
  Pressable,
  Animated,
  Easing,
} from 'react-native';

import DefaultMarker from './DefaultMarker';
import DefaultLabel from './DefaultLabel';
import { createArray, valueToPosition, positionToValue } from './converters';

export default class MultiSlider extends React.Component {
  static defaultProps = {
    values: [0],
    onValuesChangeStart: () => {},
    onValuesChange: values => {},
    onValuesChangeFinish: values => {},
    onMarkersPosition: values => {},
    step: 1,
    min: 0,
    max: 10,
    touchDimensions: {
      height: 40,
      width: 40,
      borderRadius: 15,
      slipDisplacement: 200,
    },
    customMarker: DefaultMarker,
    customMarkerLeft: DefaultMarker,
    customMarkerRight: DefaultMarker,
    customLabel: DefaultLabel,
    markerOffsetX: 0,
    markerOffsetY: 0,
    markerSize: 0,
    sliderLength: 280,
    onToggleOne: undefined,
    onToggleTwo: undefined,
    stepsAs: [],
    showSteps: false,
    showStepMarkers: true,
    showStepLabels: true,
    enabledOne: true,
    enabledTwo: true,
    allowOverlap: false,
    snapped: false,
    smoothSnapped: false,
    vertical: false,
    minMarkerOverlapDistance: 0,
    minMarkerOverlapStepDistance: 0,
    testID: '',
  };

  constructor(props) {
    super(props);

    if (
      this.props.minMarkerOverlapDistance > 0 &&
      this.props.minMarkerOverlapStepDistance > 0
    ) {
      console.error(
        'You should provide either "minMarkerOverlapDistance" or "minMarkerOverlapStepDistance", not both. Expect unreliable results.',
      );
    }

    this.optionsArray =
      this.props.optionsArray ||
      createArray(this.props.min, this.props.max, this.props.step);
    this.stepLength = this.props.sliderLength / (this.optionsArray.length - 1);

    var initialValues = this.props.values.map(value =>
      valueToPosition(
        value,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      ),
    );

    var tempStepsAs = {};
    this.props.stepsAs.forEach(step => {
      if (step?.index !== undefined) {
        tempStepsAs[step?.index] = step;
      }
    });

    this.stepsAs = {};
    this.optionsArray.forEach((ops, index) => {
      if (tempStepsAs[index]) {
        var step = tempStepsAs[index];
        this.stepsAs[index] = {
          stepLabel: step?.stepLabel ? step.stepLabel : ops,
          suffix: step?.suffix ? step.suffix : '',
          prefix: step?.prefix ? step.prefix : '',
        };
      } else {
        this.stepsAs[index] = {
          stepLabel: ops,
          suffix: '',
          prefix: '',
        };
      }
    });

    this.state = {
      pressedOne: true,
      valueOne: this.props.values[0],
      valueTwo: this.props.values[1],
      pastOne: initialValues[0],
      pastTwo: initialValues[1],
      positionOne: initialValues[0],
      positionTwo: initialValues[1],
      animation: new Animated.Value(initialValues[0]),
    };

    this.subscribePanResponder();
  }

  subscribePanResponder = () => {
    var customPanResponder = (start, move, end) => {
      return PanResponder.create({
        onStartShouldSetPanResponder: (evt, gestureState) => true,
        onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
        onMoveShouldSetPanResponder: (evt, gestureState) => true,
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
        onPanResponderGrant: (evt, gestureState) => start(),
        onPanResponderMove: (evt, gestureState) => move(gestureState),
        onPanResponderTerminationRequest: (evt, gestureState) => false,
        onPanResponderRelease: (evt, gestureState) => end(gestureState),
        onPanResponderTerminate: (evt, gestureState) => end(gestureState),
        onShouldBlockNativeResponder: (evt, gestureState) => true,
      });
    };

    this._panResponderBetween = customPanResponder(
      gestureState => {
        this.startOne(gestureState);
        this.startTwo(gestureState);
      },
      gestureState => {
        this.moveOne(gestureState);
        this.moveTwo(gestureState);
      },
      gestureState => {
        this.endOne(gestureState);
        this.endTwo(gestureState);
      },
    );

    this._panResponderOne = customPanResponder(
      this.startOne,
      this.moveOne,
      this.endOne,
    );
    this._panResponderTwo = customPanResponder(
      this.startTwo,
      this.moveTwo,
      this.endTwo,
    );
  };

  startOne = () => {
    if (this.props.enabledOne) {
      this.props.onValuesChangeStart();
      this.setState({
        onePressed: !this.state.onePressed,
      });
    }
  };

  startTwo = () => {
    if (this.props.enabledTwo) {
      this.props.onValuesChangeStart();
      this.setState({
        twoPressed: !this.state.twoPressed,
      });
    }
  };

  moveOne = gestureState => {
    if (!this.props.enabledOne) {
      return;
    }

    const accumDistance = this.props.vertical
      ? -gestureState.dy
      : gestureState.dx;

    const accumDistanceDisplacement = this.props.vertical
      ? gestureState.dx
      : gestureState.dy;

    const unconfined = I18nManager.isRTL
      ? this.state.pastOne - accumDistance
      : accumDistance + this.state.pastOne;

    var bottom = this.props.markerSize / 2;

    var trueTop =
      this.state.positionTwo -
      (this.props.allowOverlap
        ? 0
        : this.props.minMarkerOverlapDistance > 0
        ? this.props.minMarkerOverlapDistance
        : (this.props.minMarkerOverlapStepDistance || 1) * this.stepLength);

    var top =
      trueTop === 0
        ? 0
        : trueTop || this.props.sliderLength - this.props.markerSize / 2;

    var confined =
      unconfined < bottom ? bottom : unconfined > top ? top : unconfined;

    var slipDisplacement = this.props.touchDimensions.slipDisplacement;

    if (
      Math.abs(accumDistanceDisplacement) < slipDisplacement ||
      !slipDisplacement
    ) {
      var value = positionToValue(
        confined,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );

      var snapped = valueToPosition(
        value,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );

      this.setState({
        positionOne: this.props.snapped ? snapped : confined,
      });

      if (value !== this.state.valueOne) {
        this.setState(
          {
            valueOne: value,
          },
          () => {
            var change = [this.state.valueOne];
            if (this.state.valueTwo) {
              change.push(this.state.valueTwo);
            }
            this.props.onValuesChange(change);

            this.props.onMarkersPosition([
              this.state.positionOne,
              this.state.positionTwo,
            ]);
          },
        );
      }
    }
  };

  moveTwo = gestureState => {
    if (!this.props.enabledTwo) {
      return;
    }

    const accumDistance = this.props.vertical
      ? -gestureState.dy
      : gestureState.dx;
    const accumDistanceDisplacement = this.props.vertical
      ? gestureState.dx
      : gestureState.dy;

    const unconfined = I18nManager.isRTL
      ? this.state.pastTwo - accumDistance
      : accumDistance + this.state.pastTwo;
    var bottom =
      this.state.positionOne +
      (this.props.allowOverlap
        ? 0
        : this.props.minMarkerOverlapDistance > 0
        ? this.props.minMarkerOverlapDistance
        : (this.props.minMarkerOverlapStepDistance || 1) * this.stepLength);
    var top = this.props.sliderLength - this.props.markerSize / 2;
    var confined =
      unconfined < bottom ? bottom : unconfined > top ? top : unconfined;
    var slipDisplacement = this.props.touchDimensions.slipDisplacement;

    if (
      Math.abs(accumDistanceDisplacement) < slipDisplacement ||
      !slipDisplacement
    ) {
      var value = positionToValue(
        confined,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      var snapped = valueToPosition(
        value,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );

      this.setState({
        positionTwo: this.props.snapped ? snapped : confined,
      });

      if (value !== this.state.valueTwo) {
        this.setState(
          {
            valueTwo: value,
          },
          () => {
            this.props.onValuesChange([
              this.state.valueOne,
              this.state.valueTwo,
            ]);

            this.props.onMarkersPosition([
              this.state.positionOne,
              this.state.positionTwo,
            ]);
          },
        );
      }
    }
  };

  endOne = gestureState => {
    if (gestureState.moveX === 0 && this.props.onToggleOne) {
      this.props.onToggleOne();
      return;
    }

    var snapped = valueToPosition(
      this.state.valueOne,
      this.optionsArray,
      this.props.sliderLength,
    );

    this.setState(
      {
        pastOne: this.props.smoothSnapped ? snapped : this.state.positionOne,
        ...(this.props.smoothSnapped ? { positionOne: snapped } : {}),
        onePressed: !this.state.onePressed,
      },
      () => {
        var change = [this.state.valueOne];
        if (this.state.valueTwo) {
          change.push(this.state.valueTwo);
        }
        this.props.onValuesChangeFinish(change);
      },
    );
  };

  endTwo = gestureState => {
    if (gestureState.moveX === 0 && this.props.onToggleTwo) {
      this.props.onToggleTwo();
      return;
    }

    var snapped = valueToPosition(
      this.state.valueTwo,
      this.optionsArray,
      this.props.sliderLength,
    );

    this.setState(
      {
        twoPressed: !this.state.twoPressed,
        pastTwo: this.props.smoothSnapped ? snapped : this.state.positionTwo,
        ...(this.props.smoothSnapped ? { positionTwo: snapped } : {}),
      },
      () => {
        this.props.onValuesChangeFinish([
          this.state.valueOne,
          this.state.valueTwo,
        ]);
      },
    );
  };

  componentDidUpdate(prevProps, prevState) {
    const {
      positionOne: prevPositionOne,
      positionTwo: prevPositionTwo,
    } = prevState;

    const { positionOne, positionTwo } = this.state;

    if (
      typeof positionOne === 'undefined' &&
      typeof positionTwo !== 'undefined'
    ) {
      return;
    }

    if (positionOne !== prevPositionOne || positionTwo !== prevPositionTwo) {
      this.props.onMarkersPosition([positionOne, positionTwo]);

      Animated.timing(this.state.animation, {
        toValue: positionOne,
        duration: 200,
        easing: Easing.bezier(0.75, 0, 0.25, 1),
        useNativeDriver: true,
      }).start();
    }

    if (this.state.onePressed || this.state.twoPressed) {
      return;
    }

    let nextState = {};
    if (
      prevProps.min !== this.props.min ||
      prevProps.max !== this.props.max ||
      prevProps.step !== this.props.step ||
      prevProps.values[0] !== this.props.values[0] ||
      prevProps.sliderLength !== this.props.sliderLength ||
      prevProps.values[1] !== this.props.values[1] ||
      (prevProps.sliderLength !== this.props.sliderLength &&
        prevProps.values[1])
    ) {
      this.optionsArray =
        this.props.optionsArray ||
        createArray(this.props.min, this.props.max, this.props.step);

      this.stepLength = this.props.sliderLength / this.optionsArray.length;

      const positionOne = valueToPosition(
        this.props.values[0],
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      nextState.valueOne = this.props.values[0];
      nextState.pastOne = positionOne;
      nextState.positionOne = positionOne;

      const positionTwo = valueToPosition(
        this.props.values[1],
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      nextState.valueTwo = this.props.values[1];
      nextState.pastTwo = positionTwo;
      nextState.positionTwo = positionTwo;

      this.setState(nextState);
    }
  }

  getSteps() {
    const stepLength = this.props.sliderLength / (this.optionsArray.length - 1);
    const textStyles = [
      styles.stepLabel,
      this.props.stepLabelStyle,
      ...(this.props.vertical ? [{ transform: [{ rotate: '90deg' }] }] : []),
    ];
    const markerHeight = this.props?.trackStyle?.height || styles.track.height;
    const markerStyles = [
      styles.stepMarker,
      {
        height: markerHeight,
        width: markerHeight,
        borderRadius: markerHeight / 2,
      },
      this.props.stepMarkerStyle,
    ];

    return this.optionsArray.map((number, index) => {
      var step = this.stepsAs[index];

      const animatedOpacity = this.state.animation.interpolate({
        inputRange: [Math.max(index - 1, 0) * stepLength, index * stepLength],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });

      return (
        <Pressable
          key={number}
          onPress={() => {
            this.setState({ valueOne: number });
            this.props.onValuesChange([number]);
          }}
          style={[
            styles.step,
            this.props.stepStyle,
            styles.stepMarkerPressContainer,
            {
              left: stepLength * index,
            },
          ]}
        >
          {this.props.showStepMarkers &&
            index !== 0 &&
            index !== this.optionsArray.length - 1 && (
              <View
                style={[
                  markerStyles,
                  { // Magic values to center the step marker in its press container
                    transform: [{ translateX: 8 }, { translateY: 7 }],
                  },
                ]}
              >
                {/* Clone of the step marker, but with 'selected' style applied. It's better to render the component twice and animate
                the clone's opacity, rather than render it once and animate its color (as color animations don't support the native driver). */}
                <Animated.View
                  style={[
                    markerStyles,
                    this.props.selectedStepMarkerStyle,
                    { // Magic value to render the selected version directly on top of the unselected one
                      transform: [{ translateX: -2 }],
                      opacity: animatedOpacity,
                    },
                  ]}
                />
              </View>
            )}
          {this.props.showStepLabels && (
            <Text
              style={textStyles}
            >{`${step.prefix}${step.stepLabel}${step.suffix}`}</Text>
          )}
        </Pressable>
      );
    });
  }

  render() {
    const { positionOne, positionTwo } = this.state;
    const {
      selectedStyle,
      unselectedStyle,
      sliderLength,
      markerOffsetY,
    } = this.props;
    const twoMarkers = this.props.values.length == 2; // when allowOverlap, positionTwo could be 0, identified as string '0' and throwing 'RawText 0 needs to be wrapped in <Text>' error

    const selectedTrackStyle = {
      ...(selectedStyle || styles.selectedTrack),
      zIndex: 1,
      width: twoMarkers ? positionTwo - positionOne : sliderLength,
      left: twoMarkers ? positionOne : 0,
      ...(!twoMarkers && {
        transform: [
          {
            translateX: this.props.showSteps
              ? Animated.add(
                  -this.props.sliderLength,
                  this.state.animation,
                )
              : -this.props.sliderLength + this.state.positionOne,
          },
        ],
      })
    };

    const unselectedTrackStyle = {
      ...unselectedStyle,
      position: 'absolute',
      width: sliderLength,
      top: 0,
      left: 0,
    };

    const Marker = this.props.customMarker;

    const MarkerLeft = this.props.customMarkerLeft;
    const MarkerRight = this.props.customMarkerRight;
    const isMarkersSeparated = this.props.isMarkersSeparated || false;

    const Label = this.props.customLabel;

    const { height, width, borderRadius } = this.props.touchDimensions;
    const touchStyle = {
      borderRadius: borderRadius || 0,
      ...(height && { height }),
      ...(width && { width }),
    };

    const markerContainerOne = {
      top: markerOffsetY - 24,
      zIndex: 2,
      transform: [
        {
          translateX:
            !twoMarkers && this.props.showSteps
              ? Animated.subtract(this.state.animation, 24)
              : this.state.positionOne - 24,
        },
      ],
    };

    const markerContainerTwo = {
      top: markerOffsetY - 24,
      zIndex: 2,
      transform: [{ translateX: positionTwo - 24 }],
    };

    const containerStyle = [styles.container, this.props.containerStyle];

    if (this.props.vertical) {
      containerStyle.push({
        transform: [{ rotate: '-90deg' }],
      });
    }

    const body = (
      <React.Fragment>
        <View style={[styles.fullTrack, { width: sliderLength }]}>
          <View // A wrapper for the selected track which obscures the part that protrudes out of the slider bounds
            style={{
              zIndex: 1,
              overflow: 'hidden',
              width: sliderLength,
            }}
          >
            {/* SELECTED TRACK */}
            <Animated.View
              style={[
                styles.track,
                this.props.trackStyle,
                selectedTrackStyle,
   
              ]}
              {...(twoMarkers ? this._panResponderBetween.panHandlers : {})}
            />
          </View>

          {/* BACKGROUND TRACK */}
          <View
            style={[
              styles.track,
              this.props.trackStyle,
              unselectedTrackStyle,
            ]}
          />

          {/* STEP MARKERS */}
          {this.props.showSteps && this.getSteps()}

          {/* 1ST MARKER (START) */}
          <Animated.View
            style={[
              styles.markerContainer,
              markerContainerOne,
              this.props.markerContainerStyle,
              positionOne > sliderLength / 2 && styles.topMarkerContainer,
            ]}
          >
            {this.props.enableLabel && (
              <View
                style={styles.labelContainer}
              >
                <Label
                  oneMarkerValue={this.state.valueOne}
                  twoMarkerValue={this.state.valueTwo}
                  minValue={this.props.min}
                  maxValue={this.props.max}
                  oneMarkerLeftPosition={positionOne}
                  twoMarkerLeftPosition={positionTwo}
                  oneMarkerPressed={this.state.onePressed}
                  twoMarkerPressed={this.state.twoPressed}
                />
              </View>
            )}
            <View
              style={[styles.touch, touchStyle]}
              ref={component => (this._markerOne = component)}
              {...this._panResponderOne.panHandlers}
            >
              {isMarkersSeparated === false ? (
                <Marker
                  accessibilityLabel={this.props.startMarkerA11yLabel}
                  accessibilityHint={this.props.startMarkerA11yHint}
                  enabled={this.props.enabledOne}
                  pressed={this.state.onePressed}
                  markerStyle={this.props.markerStyle}
                  pressedMarkerStyle={this.props.pressedMarkerStyle}
                  disabledMarkerStyle={this.props.disabledMarkerStyle}
                  currentValue={this.state.valueOne}
                  valuePrefix={this.props.valuePrefix}
                  valueSuffix={this.props.valueSuffix}
                />
              ) : (
                <MarkerLeft
                  accessibilityLabel={this.props.startMarkerA11yLabel}
                  accessibilityHint={this.props.startMarkerA11yHint}
                  enabled={this.props.enabledOne}
                  pressed={this.state.onePressed}
                  markerStyle={this.props.markerStyle}
                  pressedMarkerStyle={this.props.pressedMarkerStyle}
                  disabledMarkerStyle={this.props.disabledMarkerStyle}
                  currentValue={this.state.valueOne}
                  valuePrefix={this.props.valuePrefix}
                  valueSuffix={this.props.valueSuffix}
                />
              )}
            </View>
          </Animated.View>

          {/* 2ND MARKER (END) */}
          {twoMarkers && positionOne !== this.props.sliderLength && (
            <View
              style={[
                styles.markerContainer,
                markerContainerTwo,
                this.props.markerContainerStyle,
              ]}
            >
              <View
                style={[styles.touch, touchStyle]}
                ref={component => (this._markerTwo = component)}
                {...this._panResponderTwo.panHandlers}
              >
                {isMarkersSeparated === false ? (
                  <Marker
                    accessibilityLabel={this.props.endMarkerA11yLabel}
                    accessibilityHint={this.props.endtMarkerA11yHint}
                    pressed={this.state.twoPressed}
                    markerStyle={this.props.markerStyle}
                    pressedMarkerStyle={this.props.pressedMarkerStyle}
                    disabledMarkerStyle={this.props.disabledMarkerStyle}
                    currentValue={this.state.valueTwo}
                    enabled={this.props.enabledTwo}
                    valuePrefix={this.props.valuePrefix}
                    valueSuffix={this.props.valueSuffix}
                  />
                ) : (
                  <MarkerRight
                    accessibilityLabel={this.props.endMarkerA11yLabel}
                    accessibilityHint={this.props.endtMarkerA11yHint}
                    pressed={this.state.twoPressed}
                    markerStyle={this.props.markerStyle}
                    pressedMarkerStyle={this.props.pressedMarkerStyle}
                    disabledMarkerStyle={this.props.disabledMarkerStyle}
                    currentValue={this.state.valueTwo}
                    enabled={this.props.enabledTwo}
                    valuePrefix={this.props.valuePrefix}
                    valueSuffix={this.props.valueSuffix}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </React.Fragment>
    );

    return (
      <View testID={this.props.testID}>
        {this.props.imageBackgroundSource && (
          <ImageBackground
            source={this.props.imageBackgroundSource}
            style={[{ width: '100%', height: '100%' }, containerStyle]}
          >
            {body}
          </ImageBackground>
        )}
        {!this.props.imageBackgroundSource && (
          <View style={containerStyle}>{body}</View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: 42,
    justifyContent: 'center',
  },
  fullTrack: {
    flexDirection: 'row',
  },
  track: {
    ...Platform.select({
      ios: {
        height: 2,
        borderRadius: 2,
        backgroundColor: '#A7A7A7',
      },
      android: {
        height: 2,
        backgroundColor: '#CECECE',
      },
      web: {
        height: 2,
        borderRadius: 2,
        backgroundColor: '#A7A7A7',
      },
    }),
  },
  selectedTrack: {
    ...Platform.select({
      ios: {
        backgroundColor: '#095FFF',
      },
      android: {
        backgroundColor: '#0D8675',
      },
      web: {
        backgroundColor: '#095FFF',
      },
    }),
  },
  markerContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelContainer: {
    position: 'absolute',
    flexGrow: 1,
    transform: [{ translateY: -23 }],
  },
  topMarkerContainer: {
    zIndex: 1,
  },
  touch: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  step: {
    position: 'absolute',
    marginLeft: -5,
  },
  stepMarker: {
    position: 'absolute',
    left: 2,
    width: 6,
    height: 6,
    backgroundColor: '#0000008c',
    borderRadius: 3,
  },
  stepMarkerPressContainer: {
    width: 21,
    height: 21,
    borderRadius: 6,
    transform: [{ translateX: -6 }, { translateY: -10 }],
    top: 0,
  },
  stepLabel: {
    position: 'absolute',
    top: 15,
    color: '#333',
  },
});
