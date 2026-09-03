'use strict';

customElements.define('compodoc-menu', class extends HTMLElement {
    constructor() {
        super();
        this.isNormalMode = this.getAttribute('mode') === 'normal';
    }

    connectedCallback() {
        this.render(this.isNormalMode);
    }

    render(isNormalMode) {
        let tp = lithtml.html(`
        <nav>
            <ul class="list">
                <li class="title">
                    <a href="index.html" data-type="index-link">Git4School documentation</a>
                </li>

                <li class="divider"></li>
                ${ isNormalMode ? `<div id="book-search-input" role="search"><input type="text" placeholder="Type to search"></div>` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                        <li class="link">
                            <a href="overview.html" data-type="chapter-link">
                                <span class="icon ion-ios-keypad"></span>Overview
                            </a>
                        </li>
                        <li class="link">
                            <a href="index.html" data-type="chapter-link">
                                <span class="icon ion-ios-paper"></span>README
                            </a>
                        </li>
                        <li class="link">
                            <a href="changelog.html"  data-type="chapter-link">
                                <span class="icon ion-ios-paper"></span>CHANGELOG
                            </a>
                        </li>
                        <li class="link">
                            <a href="license.html"  data-type="chapter-link">
                                <span class="icon ion-ios-paper"></span>LICENSE
                            </a>
                        </li>
                                <li class="link">
                                    <a href="dependencies.html" data-type="chapter-link">
                                        <span class="icon ion-ios-list"></span>Dependencies
                                    </a>
                                </li>
                                <li class="link">
                                    <a href="properties.html" data-type="chapter-link">
                                        <span class="icon ion-ios-apps"></span>Properties
                                    </a>
                                </li>
                    </ul>
                </li>
                    <li class="chapter additional">
                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ? 'data-target="#additional-pages"'
                            : 'data-target="#xs-additional-pages"' }>
                            <span class="icon ion-ios-book"></span>
                            <span>Additional documentation</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="additional-pages"' : 'id="xs-additional-pages"' }>
                                    <li class="link ">
                                        <a href="additional-documentation/architecture-details.html" data-type="entity-link" data-context-id="additional">Architecture details</a>
                                    </li>
                        </ul>
                    </li>
                    <li class="chapter modules">
                        <a data-type="chapter-link" href="modules.html">
                            <div class="menu-toggler linked" data-toggle="collapse" ${ isNormalMode ?
                                'data-target="#modules-links"' : 'data-target="#xs-modules-links"' }>
                                <span class="icon ion-ios-archive"></span>
                                <span class="link-name">Modules</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                        </a>
                        <ul class="links collapse " ${ isNormalMode ? 'id="modules-links"' : 'id="xs-modules-links"' }>
                            <li class="link">
                                <a href="modules/AppModule.html" data-type="entity-link" >AppModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ?
                                            'data-target="#components-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' : 'data-target="#xs-components-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' }>
                                            <span class="icon ion-md-cog"></span>
                                            <span>Components</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="components-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' :
                                            'id="xs-components-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' }>
                                            <li class="link">
                                                <a href="components/AppComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AppComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/AppNavLayoutComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AppNavLayoutComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/AssignmentChooserComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AssignmentChooserComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/AuthLangNavItemComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthLangNavItemComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/ConfigurationComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ConfigurationComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/EditMilestoneComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >EditMilestoneComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/EditRepositoriesComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >EditRepositoriesComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/EditSessionComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >EditSessionComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/FileChooserComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >FileChooserComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/FourOhFourComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >FourOhFourComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/HelpNavItemComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >HelpNavItemComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/HomeComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >HomeComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/MetadataComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >MetadataComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/ModalAddRepositoriesComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ModalAddRepositoriesComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/OverviewComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >OverviewComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/OverviewGraphContextualMenuComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >OverviewGraphContextualMenuComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/QuestionsChooserComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >QuestionsChooserComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/QuestionsCompletionComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >QuestionsCompletionComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/SidebarSettingsComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SidebarSettingsComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/StudentsCommitsComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >StudentsCommitsComponent</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ?
                                        'data-target="#injectables-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' : 'data-target="#xs-injectables-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' :
                                        'id="xs-injectables-links-module-AppModule-da6d324a09db4b4c89bcd01ce6018113b3eca177c6c5232ed37dd9f2add6b0193d91c314fcd01daf660c5afa7c115965bb950e8fd5e5d5f55e0a791cb587e423"' }>
                                        <li class="link">
                                            <a href="injectables/AuthService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/CommitsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CommitsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/DataService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DataService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/DatabaseService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DatabaseService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/JsonManagerService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JsonManagerService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ToastService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ToastService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/AppRoutingModule.html" data-type="entity-link" >AppRoutingModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/SharedUiModule.html" data-type="entity-link" >SharedUiModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ?
                                            'data-target="#components-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' : 'data-target="#xs-components-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' }>
                                            <span class="icon ion-md-cog"></span>
                                            <span>Components</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="components-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' :
                                            'id="xs-components-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' }>
                                            <li class="link">
                                                <a href="components/CustomModalContainerComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CustomModalContainerComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/DateRangePickerComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DateRangePickerComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/DatepickerComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DatepickerComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/ModalComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ModalComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/RepoIconComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RepoIconComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/SessionDurationPickerComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionDurationPickerComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/ShortcutsModalComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ShortcutsModalComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/TextInputComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TextInputComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/TimePickerComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TimePickerComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/ToastsComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ToastsComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/TooltipComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TooltipComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/TypePickerComponent.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TypePickerComponent</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ?
                                        'data-target="#directives-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' : 'data-target="#xs-directives-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' }>
                                        <span class="icon ion-md-code-working"></span>
                                        <span>Directives</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="directives-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' :
                                        'id="xs-directives-links-module-SharedUiModule-b7ab2e7e890b150554f8d93d34d0c5a13275fbb3d48f6c40d63540902b5353a155087ff69a50a54b3574d2a3fa966003a108e82de33caf91038885993fa8a99d"' }>
                                        <li class="link">
                                            <a href="directives/TooltipDirective.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TooltipDirective</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                </ul>
                </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ? 'data-target="#components-links"' :
                            'data-target="#xs-components-links"' }>
                            <span class="icon ion-md-cog"></span>
                            <span>Components</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="components-links"' : 'id="xs-components-links"' }>
                            <li class="link">
                                <a href="components/AssignmentChooserComponent.html" data-type="entity-link" >AssignmentChooserComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/BaseEditConfigurationComponent.html" data-type="entity-link" >BaseEditConfigurationComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/BaseGraphComponent.html" data-type="entity-link" >BaseGraphComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/BaseTabEditConfigurationComponent.html" data-type="entity-link" >BaseTabEditConfigurationComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/ConfigurationComponent.html" data-type="entity-link" >ConfigurationComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/EditMilestoneComponent.html" data-type="entity-link" >EditMilestoneComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/EditRepositoriesComponent.html" data-type="entity-link" >EditRepositoriesComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/FileChooserComponent.html" data-type="entity-link" >FileChooserComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/FourOhFourComponent.html" data-type="entity-link" >FourOhFourComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/HomeComponent.html" data-type="entity-link" >HomeComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/MetadataComponent.html" data-type="entity-link" >MetadataComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/ModalAddRepositoriesComponent.html" data-type="entity-link" >ModalAddRepositoriesComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/OverviewComponent.html" data-type="entity-link" >OverviewComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/QuestionsChooserComponent.html" data-type="entity-link" >QuestionsChooserComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/QuestionsCompletionComponent.html" data-type="entity-link" >QuestionsCompletionComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/StudentsCommitsComponent.html" data-type="entity-link" >StudentsCommitsComponent</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ? 'data-target="#classes-links"' :
                            'data-target="#xs-classes-links"' }>
                            <span class="icon ion-ios-paper"></span>
                            <span>Classes</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="classes-links"' : 'id="xs-classes-links"' }>
                            <li class="link">
                                <a href="classes/Assignment.html" data-type="entity-link" >Assignment</a>
                            </li>
                            <li class="link">
                                <a href="classes/Commit.html" data-type="entity-link" >Commit</a>
                            </li>
                            <li class="link">
                                <a href="classes/CustomModalRef.html" data-type="entity-link" >CustomModalRef</a>
                            </li>
                            <li class="link">
                                <a href="classes/Error.html" data-type="entity-link" >Error</a>
                            </li>
                            <li class="link">
                                <a href="classes/Metadata.html" data-type="entity-link" >Metadata</a>
                            </li>
                            <li class="link">
                                <a href="classes/Milestone.html" data-type="entity-link" >Milestone</a>
                            </li>
                            <li class="link">
                                <a href="classes/OsUtils.html" data-type="entity-link" >OsUtils</a>
                            </li>
                            <li class="link">
                                <a href="classes/Repository.html" data-type="entity-link" >Repository</a>
                            </li>
                            <li class="link">
                                <a href="classes/Session.html" data-type="entity-link" >Session</a>
                            </li>
                            <li class="link">
                                <a href="classes/Utils.html" data-type="entity-link" >Utils</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ? 'data-target="#injectables-links"' :
                                'data-target="#xs-injectables-links"' }>
                                <span class="icon ion-md-arrow-round-down"></span>
                                <span>Injectables</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="injectables-links"' : 'id="xs-injectables-links"' }>
                                <li class="link">
                                    <a href="injectables/AssignmentsService.html" data-type="entity-link" >AssignmentsService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/AuthService.html" data-type="entity-link" >AuthService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/CommitsService.html" data-type="entity-link" >CommitsService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/ConfigurationService.html" data-type="entity-link" >ConfigurationService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/CustomModalService.html" data-type="entity-link" >CustomModalService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/DatabaseService.html" data-type="entity-link" >DatabaseService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/DataService.html" data-type="entity-link" >DataService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/JsonManagerService.html" data-type="entity-link" >JsonManagerService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/LoaderService.html" data-type="entity-link" >LoaderService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/NgbDateNativeUTCFranceAdapter.html" data-type="entity-link" >NgbDateNativeUTCFranceAdapter</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/ThemeService.html" data-type="entity-link" >ThemeService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/ToastService.html" data-type="entity-link" >ToastService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/TooltipService.html" data-type="entity-link" >TooltipService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/TourService.html" data-type="entity-link" >TourService</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ? 'data-target="#guards-links"' :
                            'data-target="#xs-guards-links"' }>
                            <span class="icon ion-ios-lock"></span>
                            <span>Guards</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="guards-links"' : 'id="xs-guards-links"' }>
                            <li class="link">
                                <a href="guards/AuthGuard.html" data-type="entity-link" >AuthGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/DataLoadingGuard.html" data-type="entity-link" >DataLoadingGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/DataProvidedGuard.html" data-type="entity-link" >DataProvidedGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/DataSavedGuard.html" data-type="entity-link" >DataSavedGuard</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ? 'data-target="#interfaces-links"' :
                            'data-target="#xs-interfaces-links"' }>
                            <span class="icon ion-md-information-circle-outline"></span>
                            <span>Interfaces</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? ' id="interfaces-links"' : 'id="xs-interfaces-links"' }>
                            <li class="link">
                                <a href="interfaces/CalendarDay.html" data-type="entity-link" >CalendarDay</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CustomModalOptions.html" data-type="entity-link" >CustomModalOptions</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/FilterGroup.html" data-type="entity-link" >FilterGroup</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/NavTab.html" data-type="entity-link" >NavTab</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Toast.html" data-type="entity-link" >Toast</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TypeaheadFilterItem.html" data-type="entity-link" >TypeaheadFilterItem</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/TypePickerOption.html" data-type="entity-link" >TypePickerOption</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ? 'data-target="#miscellaneous-links"'
                            : 'data-target="#xs-miscellaneous-links"' }>
                            <span class="icon ion-ios-cube"></span>
                            <span>Miscellaneous</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="miscellaneous-links"' : 'id="xs-miscellaneous-links"' }>
                            <li class="link">
                                <a href="miscellaneous/enumerations.html" data-type="entity-link">Enums</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/functions.html" data-type="entity-link">Functions</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/typealiases.html" data-type="entity-link">Type aliases</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/variables.html" data-type="entity-link">Variables</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <a data-type="chapter-link" href="routes.html"><span class="icon ion-ios-git-branch"></span>Routes</a>
                        </li>
                    <li class="chapter">
                        <a data-type="chapter-link" href="coverage.html"><span class="icon ion-ios-stats"></span>Documentation coverage</a>
                    </li>
                    <li class="divider"></li>
                    <li class="copyright">
                        Documentation generated using <a href="https://compodoc.app/" target="_blank">
                            <img data-src="images/compodoc-vectorise.png" class="img-responsive" data-type="compodoc-logo">
                        </a>
                    </li>
            </ul>
        </nav>
        `);
        this.innerHTML = tp.strings;
    }
});