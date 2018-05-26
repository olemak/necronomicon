    function updateInputsForResource (graphData, resourceUri, options, root, type) {
      options = options || {}
      const valuesField = options.compareValues ? 'compareValues' : 'values'
      const offsetCrossTypes = { 'Work': 'Publication', 'Publication': 'Work' }
      type = type || typeFromUri(resourceUri)
      root = root || ldGraph.parse(graphData).byId(resourceUri)
      if (!ractive.get('lastRoots')) {
        ractive.set('lastRoots', {})
      }

      let inputs = options.inputs || allInputs()
      let promises = []
      let skipRest = false
      let parentInputRootsCache = {}
      _.each([ true, false ], function (onlyDoSuggestionForCreateNewResource) {
        _.each(inputs, function (input, index) {
          if (!skipRest &&
            ((input.domain && type === unPrefix(input.domain) || _.contains((input.subjects), type)) ||
              (input.isSubInput && (type === input.parentInput.domain || _.contains(input.parentInput.subjectTypes, type))) ||
              (options.onlyValueSuggestions && input.suggestValueFrom && type === unPrefix(input.suggestValueFrom.domain)))) {
            let ownerInput = inputFromInputId(input.belongsToCreateResourceFormOfInput)
            if (ownerInput && ownerInput.domain &&
              input.belongsToCreateResourceFormOfInput &&
              ((input.targetResourceIsMainEntry || false) === (options.wrapperObject && options.wrapperObject.isA('MainEntry')) || false) &&
              (unPrefix(ownerInput.domain) === options.wrappedIn || !options.wrappedIn) &&
              (options.wrapperObject && options.wrapperObject.isA(options.wrappedIn) || !options.wrapperObject)) {
              let inputParentOfCreateNewResourceFormKeypath = ractive.get(`inputLinks.${input.belongsToCreateResourceFormOfInput}`)
              let ownerValueIndex = ownerInput[ valuesField ].map(value => value.current.value).indexOf(root.id)
              ractive.set(`${inputParentOfCreateNewResourceFormKeypath}.suggestedValuesForNewResource.${ownerValueIndex}`, root)
              skipRest = true
            } else {
              if (!onlyDoSuggestionForCreateNewResource) {
                const rangeStart = (options.range || {}).start || 0
                const rangeLength = options.disablePagination ? 10000 : (options.range || {}).rangeLength || ((input.parentInput || {}).pagination || 10000)
                const loadForRangeOfInputs = function (startIndex, rangeLength) {
                  return function (_root) {
                    _root = _root || root
                    input.offset = input.offset || {}
                    let offset = (input.type !== 'select-predefined-value' && input.multiple) ? (_.filter(input[ valuesField ] || [], (val) => ![ undefined, '', null ].includes(val.current.value))).length : 0
                    if (input.isSubInput) {
                      offset = 0
                    }
                    if (input.offset[ offsetCrossTypes[ type ] ]) {
                      offset = input.offset[ offsetCrossTypes[ type ] ]
                    }
                    const predicate = options.onlyValueSuggestions && input.suggestValueFrom ? input.suggestValueFrom.predicate : input.predicate

                    let actualRoots
                    if (input.isSubInput) {
                      const cachedRoot = (parentInputRootsCache[ resourceUri ] || {})[ fragmentPartOf(input.parentInput.predicate) ]
                      if (cachedRoot) {
                        actualRoots = cachedRoot.outAll(fragmentPartOf(input.parentInput.predicate))
                      } else {
                        actualRoots = (ractive.get('lastRoots')[ resourceUri ] || {})[ fragmentPartOf(input.parentInput.predicate) ] || _root.outAll(fragmentPartOf(input.parentInput.predicate))
                        parentInputRootsCache[ resourceUri ] = parentInputRootsCache[ resourceUri ] || {}
                        parentInputRootsCache[ resourceUri ][ input.parentInput.predicate ] = actualRoots
                      }
                    } else {
                      actualRoots = [ _root ]
                    }
                    let rootIndex = 0
                    _.each(_.filter(input.parentInput && input.parentInput.objectSortOrder ? sortNodes(actualRoots, input.parentInput.objectSortOrder) : actualRoots, function (root, index) {
                      return index >= startIndex && index < (startIndex + (rangeLength))
                    }), function (root) {
                      let index
                      const mainEntryInput = (input.parentInput && input.parentInput.isMainEntry === true) || (input.targetResourceIsMainEntry === true) || false
                      const mainEntryNode = (root.isA('MainEntry') === true) || ((options.wrapperObject && options.wrapperObject.isA('MainEntry') === true) || false)
                      if (options.overrideMainEntry || mainEntryInput === mainEntryNode) {
                        if (_.contains([ 'select-authorized-value', 'entity' ], input.type)) {
                          index = 0
                          let values = setMultiValues(root.outAll(fragmentPartOf(predicate)), input, rootIndex, options)
                          promises = promises.concat(loadLabelsForAuthorizedValues(values, input, 0, root))
                        } else if (input.type === 'searchable-with-result-in-side-panel' || input.type === 'searchable-authority-dropdown') {
                          if (!(input.suggestValueFrom && options.onlyValueSuggestions)) {
                            _.each(these(root.outAll(fragmentPartOf(predicate))).orIf(input.isSubInput).atLeast([ { id: '' } ]), function (node, multiValueIndex) {
                              index = (input.isSubInput ? rootIndex : multiValueIndex) + (offset)
                              const id = input.type === 'searchable-authority-dropdown' ? [ node.id ] : node.id
                              // for regular non-sub inputs, check if value is already present
                              if (!input.isSubInput && _.chain(input[ valuesField ]).pluck('current').pluck('value').filter((value) => value === id).any().value()) {
                                return
                              }

                              setIdValue(id, input, index, valuesField, options)
                              if (options.source && node.id !== '') {
                                setPreviewValues(input, node, index)
                              }
                              if (!options.onlyValueSuggestions) {
                                if (options.source) {
                                  input[ valuesField ][ index ].searchable = true
                                } else {
                                  input[ valuesField ][ index ].searchable = false
                                }
                                if (node.id !== '') {
                                  promises.push(setDisplayValue(input, index, node, _.extend(options, {
                                    onlyFirstField: options.source,
                                    valuesField
                                  })))
                                  if (!isBlankNodeUri(node.id)) {
                                    ractive.set(`${input.keypath}.${valuesField}.${index}.deletable`, true)
                                    if (input.isSubInput && !options.source) {
                                      input.parentInput.allowAddNewButton = true
                                      input[ valuesField ][ index ].nonEditable = true
                                      ractive.set(`${input.keypath}.${valuesField}.${index}.nonEditable`, true)
                                      ractive.set(`${input.parentInput.keypath}.subInputs.0.input.${valuesField}.${index}.nonEditable`, true)
                                    }
                                  }
                                }
                                setAllowNewButtonForInput(input)
                              } else {
                                setDisplayValue(input, index, node, _.extend(options, {
                                  onlyFirstField: options.source,
                                  valuesField
                                }))
                                input[ valuesField ][ index ].searchable = true
                              }
                              input[ valuesField ][ index ].subjectType = type
                              input[ valuesField ][ index ].oldSubjectType = type
                              ractive.update(`${input.keypath}.${valuesField}.${index}`)
                            })
                          } else {
                            _.each(root.getAll(fragmentPartOf(predicate)), function (node, multiValueIndex) {
                              if (node.type === 'string') {
                                input.suggestedValues = input.suggestedValues || []
                                input.suggestedValues.push({
                                  value: node.value,
                                  displayValue: node.value,
                                  source: options.source
                                })
                              }
                            })
                          }
                        } else if (input.type === 'select-predefined-value') {
                          if (!options.onlyValueSuggestions) {
                            setMultiValues(these(root.outAll(fragmentPartOf(predicate))).orIf(input.isSubInput || options.compareValues).atLeast([ { id: '' } ]), input, (input.isSubInput ? rootIndex : 0) + (offset), options)
                            if (input.isSubInput && !options.source) {
                              input[ valuesField ][ rootIndex + (offset) ].nonEditable = true
                              ractive.update(`${input.keypath}.${valuesField}.${rootIndex + (offset)}`)
                              ractive.set(`${input.keypath}.${valuesField}.${rootIndex + (offset)}.nonEditable`, true)
                            }
                          } else {
                            var multiple = input.isSubInput ? input.parentInput.multiple : input.multiple
                            _
                              .chain(root.outAll(fragmentPartOf(predicate)))
                              .filter(value => !isBlankNodeUri(value.id))
                              .each(value => {
                                if (input.isSubInput && multiple) {
                                  setMultiValues(root.outAll(fragmentPartOf(predicate)), input, (input.isSubInput ? rootIndex : 0) + (offset), options)
                                  input[ valuesField ][ (input.isSubInput ? rootIndex : 0) + (offset) ].nonEditable = true
                                } else {
                                  input.suggestedValues = input.suggestedValues || []
                                  input.suggestedValues.push({
                                    value: {
                                      value: value.id,
                                      label: Main.predefinedLabelValue(input.fragment, value.id)
                                    },
                                    source: options.source
                                  })
                                }
                              })
                          }
                        } else {
                          _.each(
                            these(_.union(root.getAll(fragmentPartOf(predicate)), _.map(root.outAll(fragmentPartOf(predicate)), (node) => ({ value: node.id }))))
                              .orIf(input.isSubInput || options.compareValues || input.literal)
                              .atLeast([ { value: '' } ]), (value, index) => {
                              if (!options.onlyValueSuggestions) {
                                let valueIndex = input.isSubInput ? rootIndex : index
                                setSingleValue(value, input, (valueIndex) + (offset), _.extend(options, { setNonEditable: input.isSubInput && !options.source }))
                                if (input[ valuesField ][ valueIndex ]) {
                                  input[ valuesField ][ valueIndex ].subjectType = type
                                  input[ valuesField ][ valueIndex ].oldSubjectType = type
                                  if (input.isSubInput && !options.source) {
                                    input[ valuesField ][ valueIndex ].nonEditable = true
                                    ractive.set(`${input.parentInput.keypath}.subInputs.0.input.${valuesField}.${valueIndex}.nonEditable`, true)
                                    input.parentInput.allowAddNewButton = true
                                  } else if (input.multiple) {
                                    input.allowAddNewButton = true
                                  }
                                }
                              } else if (value.value && value.value.length > 0) {
                                input.suggestedValues = input.suggestedValues || []
                                input.suggestedValues.push({
                                  value: value.value,
                                  source: options.source
                                })
                              }
                            })
                        }
                        rootIndex++
                      }
                    })
                    input.offset[ type ] = _.flatten(_.compact(_.pluck(_.pluck(input[ valuesField ], 'current'), 'value'))).length
                    if (input.parentInput && input.parentInput.pagination) {
                      ractive.set(`${input.keypath}.nextRange`, actualRoots.length > startIndex + rangeLength ? loadForRangeOfInputs(startIndex + rangeLength, rangeLength) : null)
                      ractive.set(`${input.keypath}.prevRange`, startIndex > 0 ? loadForRangeOfInputs(Math.max(startIndex - rangeLength, 0), rangeLength) : null)
                      ractive.set(`${input.keypath}.thisRange`, loadForRangeOfInputs(startIndex, rangeLength))
                      ractive.set(`${input.keypath}.customRange`, loadForRangeOfInputs)
                      if (input.parentInput && input.parentInput.pagination && input.keypath.endsWith('0.input')) {
                        ractive.set(`${input.keypath}.rangeStats`, {
                          start: startIndex + 1,
                          end: Math.min(actualRoots.length, startIndex + rangeLength),
                          numberOfObjects: actualRoots.length,
                          rangeLength
                        })
                      }
                      if (actualRoots.length > rangeLength) {
                        const fromEnd = actualRoots.length - startIndex
                        ractive.splice(`${input.keypath}.${valuesField}`, fromEnd, Math.max(input.parentInput.pagination - fromEnd, 0))
                      }
                    }
                    return true
                  }
                }
                loadForRangeOfInputs(rangeStart, rangeLength)(root)
                if (input.parentInput) {
                  input.parentInput.nextRanges = []
                  input.parentInput.prevRanges = []
                }
              }
            }
          }
        })
      })
      Promise.all(promises).then(function () {
        if (!options.deferUpdate || promises.length > 0) {
          ractive.update()
        }
        if (!(options.keepDocumentUrl)) {
          ractive.set('save_status', translate('statusOpenedExistingResource'))
          if (!(options || {}).compareValues) {
            ractive.set(`targetUri.${type}`, resourceUri)
          }
          updateBrowserLocationWithUri(`${options.compareValues ? 'compare_with_' : ''}${type}`, resourceUri)
        }
      })
    }