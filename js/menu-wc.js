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
                                <a href="modules/AppModule.html" data-type="entity-link">AppModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ?
                                            'data-target="#components-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' : 'data-target="#xs-components-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' }>
                                            <span class="icon ion-md-cog"></span>
                                            <span>Components</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="components-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' :
                                            'id="xs-components-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' }>
                                            <li class="link">
                                                <a href="components/AppComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">AppComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/AssignmentChooserComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">AssignmentChooserComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/ConfigurationComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">ConfigurationComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/EditMilestoneComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">EditMilestoneComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/EditRepositoriesComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">EditRepositoriesComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/EditSessionsComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">EditSessionsComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/FileChooserComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">FileChooserComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/FourOhFourComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">FourOhFourComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/HomeComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">HomeComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/MetadataComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">MetadataComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/ModalAddRepositoriesComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">ModalAddRepositoriesComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/OverviewComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">OverviewComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/QuestionsChooserComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">QuestionsChooserComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/QuestionsCompletionComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">QuestionsCompletionComponent</a>
                                            </li>
                                            <li class="link">
                                                <a href="components/StudentsCommitsComponent.html"
                                                    data-type="entity-link" data-context="sub-entity" data-context-id="modules">StudentsCommitsComponent</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-toggle="collapse" ${ isNormalMode ?
                                        'data-target="#injectables-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' : 'data-target="#xs-injectables-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' :
                                        'id="xs-injectables-links-module-AppModule-6f1423aa5f71c2880dc2558297ff7ead"' }>
                                        <li class="link">
                                            <a href="injectables/AuthService.html"
                                                data-type="entity-link" data-context="sub-entity" data-context-id="modules" }>AuthService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/CommitsService.html"
                                                data-type="entity-link" data-context="sub-entity" data-context-id="modules" }>CommitsService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/DataService.html"
                                                data-type="entity-link" data-context="sub-entity" data-context-id="modules" }>DataService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/DatabaseService.html"
                                                data-type="entity-link" data-context="sub-entity" data-context-id="modules" }>DatabaseService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/JsonManagerService.html"
                                                data-type="entity-link" data-context="sub-entity" data-context-id="modules" }>JsonManagerService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/ToastService.html"
                                                data-type="entity-link" data-context="sub-entity" data-context-id="modules" }>ToastService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/AppRoutingModule.html" data-type="entity-link">AppRoutingModule</a>
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
                                <a href="components/AssignmentChooserComponent.html" data-type="entity-link">AssignmentChooserComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/BaseEditConfigurationComponent.html" data-type="entity-link">BaseEditConfigurationComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/BaseGraphComponent.html" data-type="entity-link">BaseGraphComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/BaseTabEditConfigurationComponent.html" data-type="entity-link">BaseTabEditConfigurationComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/ConfigurationComponent.html" data-type="entity-link">ConfigurationComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/EditMilestoneComponent.html" data-type="entity-link">EditMilestoneComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/EditRepositoriesComponent.html" data-type="entity-link">EditRepositoriesComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/EditSessionsComponent.html" data-type="entity-link">EditSessionsComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/FileChooserComponent.html" data-type="entity-link">FileChooserComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/FourOhFourComponent.html" data-type="entity-link">FourOhFourComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/HomeComponent.html" data-type="entity-link">HomeComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/MetadataComponent.html" data-type="entity-link">MetadataComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/ModalAddRepositoriesComponent.html" data-type="entity-link">ModalAddRepositoriesComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/OverviewComponent.html" data-type="entity-link">OverviewComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/QuestionsChooserComponent.html" data-type="entity-link">QuestionsChooserComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/QuestionsCompletionComponent.html" data-type="entity-link">QuestionsCompletionComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/StudentsCommitsComponent.html" data-type="entity-link">StudentsCommitsComponent</a>
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
                                <a href="classes/Assignment.html" data-type="entity-link">Assignment</a>
                            </li>
                            <li class="link">
                                <a href="classes/Commit.html" data-type="entity-link">Commit</a>
                            </li>
                            <li class="link">
                                <a href="classes/Error.html" data-type="entity-link">Error</a>
                            </li>
                            <li class="link">
                                <a href="classes/Metadata.html" data-type="entity-link">Metadata</a>
                            </li>
                            <li class="link">
                                <a href="classes/Milestone.html" data-type="entity-link">Milestone</a>
                            </li>
                            <li class="link">
                                <a href="classes/Repository.html" data-type="entity-link">Repository</a>
                            </li>
                            <li class="link">
                                <a href="classes/Session.html" data-type="entity-link">Session</a>
                            </li>
                            <li class="link">
                                <a href="classes/Utils.html" data-type="entity-link">Utils</a>
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
                                    <a href="injectables/AuthService.html" data-type="entity-link">AuthService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/CommitsService.html" data-type="entity-link">CommitsService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/DatabaseService.html" data-type="entity-link">DatabaseService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/DataService.html" data-type="entity-link">DataService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/JsonManagerService.html" data-type="entity-link">JsonManagerService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/LoaderService.html" data-type="entity-link">LoaderService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/ToastService.html" data-type="entity-link">ToastService</a>
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
                                <a href="guards/AuthGuard.html" data-type="entity-link">AuthGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/DataLoadingGuard.html" data-type="entity-link">DataLoadingGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/DataProvidedGuard.html" data-type="entity-link">DataProvidedGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/DataSavedGuard.html" data-type="entity-link">DataSavedGuard</a>
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