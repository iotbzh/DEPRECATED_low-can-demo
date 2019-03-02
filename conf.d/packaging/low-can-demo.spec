###########################################################################
# Copyright 2015, 2016, 2017 IoT.bzh
#
# author: Fulup Ar Foll <fulup@iot.bzh>
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
###########################################################################


Name:    low-can-demo
Version: 0.9
Release: 1
License: APL2.0
Summary: HTML5 Low level CAN service UI for demo
Url:     https://gerrit.automotivelinux.org/gerrit/apps/low-can-demo
Source0: %{name}_%{version}.orig.tar.gz

Prefix: /opt/low-can-demo
BuildRequires: cmake
BuildRequires: gcc gcc-c++
BuildRequires: 

BuildRoot:%{_tmppath}/%{name}-%{version}-build

%description
HTML5 Low level CAN service UI for demo

%prep
%setup -q

%build
%cmake -DBINDINGS_INSTALL_PREFIX:PATH=%{_libdir}
%__make %{?_smp_mflags}

%install
[ -d build ] && cd build
%make_install

%files
%defattr(-,root,root)
%dir %{_prefix}/*
%{_prefix}/*/*
